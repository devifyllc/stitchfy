"""
Review Orchestrator

Coordinates multiple agents to perform comprehensive reviews in parallel.
Aggregates feedback and provides unified results.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import json

from .base_agent import BaseAgent, AgentFeedback, ReviewContext, FeedbackSeverity


@dataclass
class ReviewResult:
    """
    Aggregated results from multiple agent reviews.
    
    Contains feedback from all agents, summary statistics, and prioritized actions.
    """
    page_name: str
    review_timestamp: str
    agent_feedbacks: List[AgentFeedback]
    overall_score: float
    total_feedback_items: int
    critical_items_count: int
    high_priority_items_count: int
    summary: str
    top_priorities: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def get_feedback_by_agent(self, agent_name: str) -> Optional[AgentFeedback]:
        """Get feedback from a specific agent"""
        for feedback in self.agent_feedbacks:
            if feedback.agent_name == agent_name:
                return feedback
        return None
    
    def get_all_critical_items(self) -> List[Dict[str, Any]]:
        """Get all critical items across all agents"""
        items = []
        for feedback in self.agent_feedbacks:
            for item in feedback.get_critical_items():
                items.append({
                    'agent': feedback.agent_name,
                    'item': item.to_dict()
                })
        return items
    
    def get_all_high_priority_items(self) -> List[Dict[str, Any]]:
        """Get all high priority items across all agents"""
        items = []
        for feedback in self.agent_feedbacks:
            for item in feedback.get_high_priority_items():
                items.append({
                    'agent': feedback.agent_name,
                    'item': item.to_dict()
                })
        return items
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'page_name': self.page_name,
            'review_timestamp': self.review_timestamp,
            'overall_score': self.overall_score,
            'total_feedback_items': self.total_feedback_items,
            'critical_items_count': self.critical_items_count,
            'high_priority_items_count': self.high_priority_items_count,
            'summary': self.summary,
            'top_priorities': self.top_priorities,
            'agent_feedbacks': [fb.to_dict() for fb in self.agent_feedbacks],
            'metadata': self.metadata,
        }
    
    def save_to_file(self, output_path: str) -> None:
        """Save review result to JSON file"""
        with open(output_path, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)
    
    def generate_markdown_report(self) -> str:
        """Generate a human-readable markdown report"""
        lines = [
            f"# Review Report: {self.page_name}",
            f"",
            f"**Review Date:** {self.review_timestamp}",
            f"**Overall Score:** {self.overall_score:.1f}/100",
            f"**Total Issues:** {self.total_feedback_items}",
            f"**Critical Issues:** {self.critical_items_count}",
            f"**High Priority Issues:** {self.high_priority_items_count}",
            f"",
            f"## Summary",
            f"",
            f"{self.summary}",
            f"",
            f"## Top Priorities",
            f"",
        ]
        
        for i, priority in enumerate(self.top_priorities, 1):
            lines.append(f"{i}. {priority}")
        
        lines.append("")
        lines.append("## Agent Reviews")
        lines.append("")
        
        for feedback in self.agent_feedbacks:
            lines.append(f"### {feedback.agent_name}")
            lines.append(f"")
            lines.append(f"**Score:** {feedback.overall_score:.1f}/100")
            lines.append(f"**Issues Found:** {len(feedback.feedback_items)}")
            lines.append(f"")
            lines.append(f"**Summary:** {feedback.summary}")
            lines.append(f"")
            
            if feedback.strengths:
                lines.append("**Strengths:**")
                for strength in feedback.strengths:
                    lines.append(f"- {strength}")
                lines.append("")
            
            if feedback.feedback_items:
                lines.append("**Issues:**")
                for item in feedback.feedback_items:
                    severity_emoji = {
                        FeedbackSeverity.CRITICAL: "🔴",
                        FeedbackSeverity.HIGH: "🟠",
                        FeedbackSeverity.MEDIUM: "🟡",
                        FeedbackSeverity.LOW: "🟢",
                        FeedbackSeverity.INFO: "ℹ️",
                    }
                    emoji = severity_emoji.get(item.severity, "•")
                    lines.append(f"- {emoji} **{item.title}** ({item.severity.value})")
                    lines.append(f"  - {item.description}")
                    lines.append(f"  - *Suggested:* {item.suggested_improvement}")
                lines.append("")
        
        return "\n".join(lines)


class ReviewOrchestrator:
    """
    Orchestrates multiple agents to perform comprehensive reviews.
    
    Runs agents in parallel, aggregates feedback, and provides unified results
    with prioritized action items.
    """
    
    def __init__(self, agents: List[BaseAgent], max_workers: int = 4):
        """
        Initialize orchestrator with agents.
        
        Args:
            agents: List of agents to run
            max_workers: Maximum parallel workers for reviews
        """
        self.agents = agents
        self.max_workers = max_workers
    
    def review(
        self,
        context: ReviewContext,
        parallel: bool = True,
        agents_to_run: Optional[List[str]] = None
    ) -> ReviewResult:
        """
        Perform comprehensive review with all agents.
        
        Args:
            context: Review context with code and specifications
            parallel: Whether to run agents in parallel
            agents_to_run: Optional list of agent names to run (runs all if None)
            
        Returns:
            Aggregated review result from all agents
        """
        # Filter agents if specified
        agents = self.agents
        if agents_to_run:
            agents = [
                agent for agent in self.agents
                if agent.get_name() in agents_to_run
            ]
        
        if not agents:
            raise ValueError("No agents available for review")
        
        # Run reviews
        if parallel:
            feedbacks = self._run_parallel_reviews(agents, context)
        else:
            feedbacks = self._run_sequential_reviews(agents, context)
        
        # Aggregate results
        return self._aggregate_results(context.page_name, feedbacks)
    
    def _run_parallel_reviews(
        self, agents: List[BaseAgent], context: ReviewContext
    ) -> List[AgentFeedback]:
        """Run agent reviews in parallel"""
        feedbacks = []
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all agent reviews
            future_to_agent = {
                executor.submit(agent.review, context): agent
                for agent in agents
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_agent):
                agent = future_to_agent[future]
                try:
                    feedback = future.result()
                    feedbacks.append(feedback)
                except Exception as e:
                    print(f"Error in {agent.get_name()}: {e}")
                    # Continue with other agents
        
        return feedbacks
    
    def _run_sequential_reviews(
        self, agents: List[BaseAgent], context: ReviewContext
    ) -> List[AgentFeedback]:
        """Run agent reviews sequentially"""
        feedbacks = []
        
        for agent in agents:
            try:
                feedback = agent.review(context)
                feedbacks.append(feedback)
            except Exception as e:
                print(f"Error in {agent.get_name()}: {e}")
                # Continue with other agents
        
        return feedbacks
    
    def _aggregate_results(
        self, page_name: str, feedbacks: List[AgentFeedback]
    ) -> ReviewResult:
        """Aggregate feedback from all agents"""
        if not feedbacks:
            raise ValueError("No feedback to aggregate")
        
        # Calculate overall score (weighted average)
        overall_score = sum(fb.overall_score for fb in feedbacks) / len(feedbacks)
        
        # Count feedback items
        total_items = sum(len(fb.feedback_items) for fb in feedbacks)
        critical_count = sum(len(fb.get_critical_items()) for fb in feedbacks)
        high_priority_count = sum(len(fb.get_high_priority_items()) for fb in feedbacks)
        
        # Generate summary
        summary = self._generate_summary(feedbacks, overall_score)
        
        # Extract top priorities
        top_priorities = self._extract_top_priorities(feedbacks)
        
        return ReviewResult(
            page_name=page_name,
            review_timestamp=datetime.utcnow().isoformat(),
            agent_feedbacks=feedbacks,
            overall_score=round(overall_score, 1),
            total_feedback_items=total_items,
            critical_items_count=critical_count,
            high_priority_items_count=high_priority_count,
            summary=summary,
            top_priorities=top_priorities,
            metadata={
                'agents_run': [fb.agent_name for fb in feedbacks],
                'total_agents': len(feedbacks),
            }
        )
    
    def _generate_summary(
        self, feedbacks: List[AgentFeedback], overall_score: float
    ) -> str:
        """Generate overall summary from all agent feedback"""
        lines = []
        
        if overall_score >= 90:
            lines.append("Excellent work! The page meets high quality standards across all areas.")
        elif overall_score >= 75:
            lines.append("Good quality overall with some areas for improvement.")
        elif overall_score >= 60:
            lines.append("Moderate quality with several important improvements needed.")
        else:
            lines.append("Significant improvements required across multiple areas.")
        
        # Add agent-specific highlights
        for feedback in feedbacks:
            if feedback.overall_score >= 90:
                lines.append(f"✓ {feedback.agent_name}: Excellent")
            elif feedback.overall_score < 60:
                lines.append(f"⚠ {feedback.agent_name}: Needs attention")
        
        return " ".join(lines)
    
    def _extract_top_priorities(
        self, feedbacks: List[AgentFeedback]
    ) -> List[str]:
        """Extract top priority items across all agents"""
        priorities = []
        
        # Collect all agent priorities
        for feedback in feedbacks:
            for priority in feedback.priorities[:3]:  # Top 3 from each
                priorities.append(f"[{feedback.agent_name}] {priority}")
        
        # Return top 10 overall
        return priorities[:10]
    
    def get_cost_estimate(self, context: ReviewContext) -> Dict[str, Any]:
        """
        Estimate total cost of running all agents.
        
        Args:
            context: Review context
            
        Returns:
            Cost estimate with breakdown by agent
        """
        estimates = []
        total_cost = 0.0
        total_tokens = 0
        
        for agent in self.agents:
            estimate = agent.get_cost_estimate(context)
            estimates.append(estimate)
            total_cost += estimate['estimated_cost_usd']
            total_tokens += estimate['estimated_total_tokens']
        
        return {
            'total_cost_usd': round(total_cost, 4),
            'total_tokens': total_tokens,
            'agent_count': len(self.agents),
            'breakdown': estimates,
        }
    
    def list_agents(self) -> List[Dict[str, Any]]:
        """List all registered agents with their info"""
        return [agent.get_info() for agent in self.agents]
