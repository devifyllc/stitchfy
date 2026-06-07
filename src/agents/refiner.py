"""
Refinement System

Implements iterative improvement loops based on agent feedback.
Takes review results and regenerates improved UI.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from pathlib import Path
import json
from datetime import datetime

from .orchestrator import ReviewResult, ReviewOrchestrator, ReviewContext
from ..generators.base_generator import BaseGenerator, UIOutput


@dataclass
class RefinementIteration:
    """
    Single refinement iteration with before/after comparison.
    """
    iteration_number: int
    timestamp: str
    before_score: float
    after_score: float
    score_improvement: float
    review_result: ReviewResult
    ui_output: UIOutput
    feedback_addressed: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'iteration_number': self.iteration_number,
            'timestamp': self.timestamp,
            'before_score': self.before_score,
            'after_score': self.after_score,
            'score_improvement': self.score_improvement,
            'feedback_addressed': self.feedback_addressed,
            'review_summary': {
                'overall_score': self.review_result.overall_score,
                'total_issues': self.review_result.total_feedback_items,
                'critical_issues': self.review_result.critical_items_count,
                'high_priority_issues': self.review_result.high_priority_items_count,
            }
        }


@dataclass
class RefinementResult:
    """
    Complete refinement process result with all iterations.
    """
    page_name: str
    initial_score: float
    final_score: float
    total_improvement: float
    iterations: List[RefinementIteration]
    converged: bool
    convergence_reason: str
    total_cost_estimate: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'page_name': self.page_name,
            'initial_score': self.initial_score,
            'final_score': self.final_score,
            'total_improvement': self.total_improvement,
            'total_iterations': len(self.iterations),
            'converged': self.converged,
            'convergence_reason': self.convergence_reason,
            'total_cost_estimate': self.total_cost_estimate,
            'iterations': [it.to_dict() for it in self.iterations],
        }
    
    def save_to_file(self, output_path: str) -> None:
        """Save refinement result to JSON file"""
        with open(output_path, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)
    
    def generate_summary_report(self) -> str:
        """Generate summary report"""
        lines = [
            f"# Refinement Summary: {self.page_name}",
            f"",
            f"**Initial Score:** {self.initial_score:.1f}/100",
            f"**Final Score:** {self.final_score:.1f}/100",
            f"**Total Improvement:** +{self.total_improvement:.1f} points",
            f"**Iterations:** {len(self.iterations)}",
            f"**Converged:** {'Yes' if self.converged else 'No'}",
            f"**Reason:** {self.convergence_reason}",
            f"",
            f"## Iteration Progress",
            f"",
        ]
        
        for iteration in self.iterations:
            lines.append(
                f"{iteration.iteration_number}. Score: {iteration.before_score:.1f} → "
                f"{iteration.after_score:.1f} (+{iteration.score_improvement:.1f})"
            )
        
        return "\n".join(lines)


class Refiner:
    """
    Implements iterative refinement based on agent feedback.
    
    Takes review results, generates improvement prompts, and regenerates UI
    until convergence or max iterations reached.
    """
    
    def __init__(
        self,
        generator: BaseGenerator,
        orchestrator: ReviewOrchestrator,
        max_iterations: int = 3,
        convergence_threshold: float = 2.0,
        target_score: float = 90.0
    ):
        """
        Initialize refiner.
        
        Args:
            generator: UI generator to use for regeneration
            orchestrator: Review orchestrator with agents
            max_iterations: Maximum refinement iterations
            convergence_threshold: Min score improvement to continue (points)
            target_score: Target score to achieve
        """
        self.generator = generator
        self.orchestrator = orchestrator
        self.max_iterations = max_iterations
        self.convergence_threshold = convergence_threshold
        self.target_score = target_score
    
    def refine(
        self,
        page_name: str,
        initial_prompt: str,
        initial_review: Optional[ReviewResult] = None,
        context: Optional[ReviewContext] = None
    ) -> RefinementResult:
        """
        Perform iterative refinement.
        
        Args:
            page_name: Name of the page
            initial_prompt: Original generation prompt
            initial_review: Optional initial review (if already done)
            context: Optional review context (project spec, brand, etc.)
            
        Returns:
            RefinementResult with all iterations
        """
        iterations = []
        current_prompt = initial_prompt
        previous_score = initial_review.overall_score if initial_review else 0.0
        
        # If no initial review, generate and review first
        if not initial_review:
            ui_output = self.generator.generate_ui(current_prompt, page_name)
            review_context = self._create_review_context(ui_output, page_name, context)
            initial_review = self.orchestrator.review(review_context)
            previous_score = initial_review.overall_score
        
        initial_score = previous_score
        
        # Refinement loop
        for i in range(self.max_iterations):
            iteration_num = i + 1
            
            # Generate refinement prompt
            refinement_prompt = self._build_refinement_prompt(
                initial_prompt,
                initial_review,
                iterations
            )
            
            # Regenerate UI
            ui_output = self.generator.generate_ui(refinement_prompt, page_name)
            
            # Review new version
            review_context = self._create_review_context(ui_output, page_name, context)
            review_result = self.orchestrator.review(review_context)
            
            # Calculate improvement
            current_score = review_result.overall_score
            improvement = current_score - previous_score
            
            # Extract addressed feedback
            feedback_addressed = self._extract_addressed_feedback(
                initial_review,
                review_result
            )
            
            # Create iteration record
            iteration = RefinementIteration(
                iteration_number=iteration_num,
                timestamp=datetime.utcnow().isoformat(),
                before_score=previous_score,
                after_score=current_score,
                score_improvement=improvement,
                review_result=review_result,
                ui_output=ui_output,
                feedback_addressed=feedback_addressed
            )
            iterations.append(iteration)
            
            # Check convergence
            converged, reason = self._check_convergence(
                current_score,
                improvement,
                iteration_num
            )
            
            if converged:
                break
            
            # Update for next iteration
            previous_score = current_score
            initial_review = review_result
        
        # Calculate total improvement
        final_score = iterations[-1].after_score if iterations else initial_score
        total_improvement = final_score - initial_score
        
        # Determine final convergence status
        if not iterations:
            converged = False
            reason = "No iterations completed"
        else:
            converged, reason = self._check_convergence(
                final_score,
                iterations[-1].score_improvement,
                len(iterations)
            )
        
        return RefinementResult(
            page_name=page_name,
            initial_score=initial_score,
            final_score=final_score,
            total_improvement=total_improvement,
            iterations=iterations,
            converged=converged,
            convergence_reason=reason,
            total_cost_estimate=0.0  # TODO: Calculate actual cost
        )
    
    def _create_review_context(
        self,
        ui_output: UIOutput,
        page_name: str,
        base_context: Optional[ReviewContext] = None
    ) -> ReviewContext:
        """Create review context from UI output"""
        return ReviewContext(
            html=ui_output.html,
            css=ui_output.css,
            javascript=ui_output.javascript,
            page_name=page_name,
            project_spec=base_context.project_spec if base_context else None,
            brand_guidelines=base_context.brand_guidelines if base_context else None,
            target_audience=base_context.target_audience if base_context else None,
            conversion_goals=base_context.conversion_goals if base_context else None,
        )
    
    def _build_refinement_prompt(
        self,
        original_prompt: str,
        review_result: ReviewResult,
        previous_iterations: List[RefinementIteration]
    ) -> str:
        """Build prompt for refinement iteration"""
        lines = [
            "# Refinement Request",
            "",
            "## Original Requirements",
            original_prompt,
            "",
            "## Review Feedback",
            f"Current Score: {review_result.overall_score:.1f}/100",
            f"Issues Found: {review_result.total_feedback_items}",
            f"Critical: {review_result.critical_items_count}, High Priority: {review_result.high_priority_items_count}",
            "",
            "## Top Priority Improvements",
            "",
        ]
        
        # Add top priorities
        for i, priority in enumerate(review_result.top_priorities[:10], 1):
            lines.append(f"{i}. {priority}")
        
        lines.extend([
            "",
            "## Detailed Feedback by Agent",
            "",
        ])
        
        # Add agent-specific feedback
        for feedback in review_result.agent_feedbacks:
            lines.append(f"### {feedback.agent_name} (Score: {feedback.overall_score:.1f}/100)")
            lines.append("")
            
            # Add critical and high priority items
            critical_items = feedback.get_critical_items()
            high_items = feedback.get_high_priority_items()
            
            if critical_items:
                lines.append("**Critical Issues:**")
                for item in critical_items:
                    lines.append(f"- {item.title}: {item.description}")
                    lines.append(f"  Suggestion: {item.suggested_improvement}")
                lines.append("")
            
            if high_items:
                lines.append("**High Priority Issues:**")
                for item in high_items:
                    lines.append(f"- {item.title}: {item.description}")
                    lines.append(f"  Suggestion: {item.suggested_improvement}")
                lines.append("")
        
        lines.extend([
            "",
            "## Instructions",
            "",
            "Regenerate the complete HTML, CSS, and JavaScript with ALL the improvements above.",
            "Focus especially on critical and high-priority issues.",
            "Maintain the original requirements while addressing all feedback.",
            "Ensure the code is production-ready and follows best practices.",
        ])
        
        return "\n".join(lines)
    
    def _extract_addressed_feedback(
        self,
        before_review: ReviewResult,
        after_review: ReviewResult
    ) -> List[str]:
        """Extract which feedback items were addressed"""
        addressed = []
        
        # Compare issue counts by category
        before_categories = {}
        after_categories = {}
        
        for feedback in before_review.agent_feedbacks:
            for item in feedback.feedback_items:
                cat = item.category.value
                before_categories[cat] = before_categories.get(cat, 0) + 1
        
        for feedback in after_review.agent_feedbacks:
            for item in feedback.feedback_items:
                cat = item.category.value
                after_categories[cat] = after_categories.get(cat, 0) + 1
        
        # Find reduced categories
        for cat, before_count in before_categories.items():
            after_count = after_categories.get(cat, 0)
            if after_count < before_count:
                addressed.append(f"Improved {cat}: {before_count} → {after_count} issues")
        
        return addressed
    
    def _check_convergence(
        self,
        current_score: float,
        improvement: float,
        iteration_num: int
    ) -> tuple[bool, str]:
        """Check if refinement has converged"""
        # Target score reached
        if current_score >= self.target_score:
            return True, f"Target score {self.target_score} reached"
        
        # Max iterations reached
        if iteration_num >= self.max_iterations:
            return True, f"Maximum iterations ({self.max_iterations}) reached"
        
        # Minimal improvement (convergence)
        if improvement < self.convergence_threshold:
            return True, f"Improvement below threshold ({improvement:.1f} < {self.convergence_threshold})"
        
        # Score decreased (regression)
        if improvement < 0:
            return True, f"Score decreased by {abs(improvement):.1f} points"
        
        # Continue refining
        return False, "Continuing refinement"
