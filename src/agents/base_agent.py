"""
Base Agent Architecture

Defines the abstract interface and data models for all Stitchfy review agents.
Uses OpenAI Structured Outputs for reliable, type-safe feedback.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any
from enum import Enum
from datetime import datetime


class FeedbackSeverity(str, Enum):
    """Severity levels for feedback items"""
    CRITICAL = "critical"      # Must fix - breaks functionality or compliance
    HIGH = "high"              # Should fix - significant impact on quality
    MEDIUM = "medium"          # Nice to have - moderate improvement
    LOW = "low"                # Optional - minor enhancement
    INFO = "info"              # Informational - no action required


class FeedbackCategory(str, Enum):
    """Categories of feedback"""
    # SEO
    SEO_METADATA = "seo_metadata"
    SEO_STRUCTURE = "seo_structure"
    SEO_CONTENT = "seo_content"
    SEO_PERFORMANCE = "seo_performance"
    
    # UX
    UX_NAVIGATION = "ux_navigation"
    UX_LAYOUT = "ux_layout"
    UX_INTERACTION = "ux_interaction"
    UX_VISUAL_HIERARCHY = "ux_visual_hierarchy"
    UX_MOBILE = "ux_mobile"
    
    # Accessibility
    A11Y_SEMANTIC = "a11y_semantic"
    A11Y_ARIA = "a11y_aria"
    A11Y_KEYBOARD = "a11y_keyboard"
    A11Y_COLOR_CONTRAST = "a11y_color_contrast"
    A11Y_FORMS = "a11y_forms"
    
    # Marketing
    MARKETING_COPY = "marketing_copy"
    MARKETING_CTA = "marketing_cta"
    MARKETING_VALUE_PROP = "marketing_value_prop"
    MARKETING_TRUST = "marketing_trust"
    MARKETING_CONVERSION = "marketing_conversion"
    
    # Design
    DESIGN_COLOR = "design_color"
    DESIGN_TYPOGRAPHY = "design_typography"
    DESIGN_SPACING = "design_spacing"
    DESIGN_COMPONENTS = "design_components"
    DESIGN_ANIMATIONS = "design_animations"
    DESIGN_CSS_MODERN = "design_css_modern"
    DESIGN_VISUAL_HIERARCHY = "design_visual_hierarchy"
    DESIGN_RESPONSIVE = "design_responsive"
    
    # Technical/QA
    TECHNICAL_FILE_REFS = "technical_file_refs"
    TECHNICAL_HTML_VALIDATION = "technical_html_validation"
    TECHNICAL_LINKS = "technical_links"
    TECHNICAL_JAVASCRIPT = "technical_javascript"
    TECHNICAL_RESOURCES = "technical_resources"
    TECHNICAL_PERFORMANCE = "technical_performance"
    TECHNICAL_COMPATIBILITY = "technical_compatibility"
    TECHNICAL_BEST_PRACTICES = "technical_best_practices"
    
    # General
    GENERAL = "general"


@dataclass
class FeedbackItem:
    """
    Individual feedback item from an agent.
    
    This represents a single actionable piece of feedback with context,
    severity, and suggested improvements.
    """
    category: FeedbackCategory
    severity: FeedbackSeverity
    title: str
    description: str
    current_state: str
    suggested_improvement: str
    impact: str
    code_reference: Optional[str] = None
    line_number: Optional[int] = None
    wcag_criterion: Optional[str] = None  # For accessibility
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            k: v.value if isinstance(v, Enum) else v
            for k, v in asdict(self).items()
            if v is not None
        }


@dataclass
class AgentFeedback:
    """
    Complete feedback from a single agent review.
    
    Contains all feedback items, summary statistics, and metadata.
    """
    agent_name: str
    agent_version: str
    review_timestamp: str
    page_name: str
    overall_score: float  # 0-100
    summary: str
    feedback_items: List[FeedbackItem]
    strengths: List[str]
    priorities: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def get_critical_items(self) -> List[FeedbackItem]:
        """Get all critical severity items"""
        return [
            item for item in self.feedback_items
            if item.severity == FeedbackSeverity.CRITICAL
        ]
    
    def get_high_priority_items(self) -> List[FeedbackItem]:
        """Get critical and high severity items"""
        return [
            item for item in self.feedback_items
            if item.severity in [FeedbackSeverity.CRITICAL, FeedbackSeverity.HIGH]
        ]
    
    def get_items_by_category(self, category: FeedbackCategory) -> List[FeedbackItem]:
        """Get all items in a specific category"""
        return [
            item for item in self.feedback_items
            if item.category == category
        ]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'agent_name': self.agent_name,
            'agent_version': self.agent_version,
            'review_timestamp': self.review_timestamp,
            'page_name': self.page_name,
            'overall_score': self.overall_score,
            'summary': self.summary,
            'feedback_items': [item.to_dict() for item in self.feedback_items],
            'strengths': self.strengths,
            'priorities': self.priorities,
            'metadata': self.metadata,
        }


@dataclass
class ReviewContext:
    """
    Context provided to agents for review.
    
    Contains all information agents need to perform comprehensive reviews.
    """
    html: str
    css: str
    javascript: str
    page_name: str
    project_spec: Optional[str] = None
    brand_guidelines: Optional[str] = None
    target_audience: Optional[str] = None
    conversion_goals: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class AgentConfig:
    """
    Configuration for agent behavior.
    
    Controls how agents perform reviews and generate feedback.
    """
    api_key: str
    model: str = "gpt-4o"
    temperature: float = 0.3  # Lower for more consistent reviews
    max_tokens: int = 4000
    enable_structured_output: bool = True
    strict_mode: bool = True  # Enforce all feedback requirements
    custom_instructions: Optional[str] = None
    
    def validate(self) -> None:
        """Validate configuration"""
        if not self.api_key:
            raise ValueError("API key is required")
        if self.temperature < 0 or self.temperature > 2:
            raise ValueError("Temperature must be between 0 and 2")
        if self.max_tokens < 100:
            raise ValueError("max_tokens must be at least 100")


class BaseAgent(ABC):
    """
    Abstract base class for all Stitchfy review agents.
    
    Agents analyze generated UI code and provide structured feedback
    using OpenAI's Structured Outputs for reliability and type safety.
    
    Each agent specializes in a specific domain (SEO, UX, Accessibility, Marketing)
    and returns actionable feedback with severity levels and improvement suggestions.
    """
    
    def __init__(self, config: AgentConfig):
        """
        Initialize agent with configuration.
        
        Args:
            config: Agent configuration including API credentials and behavior settings
        """
        config.validate()
        self.config = config
        self._client = None
    
    @abstractmethod
    def get_name(self) -> str:
        """
        Get the agent's name.
        
        Returns:
            Human-readable agent name (e.g., "SEO Agent", "UX Agent")
        """
        pass
    
    @abstractmethod
    def get_version(self) -> str:
        """
        Get the agent's version.
        
        Returns:
            Semantic version string (e.g., "1.0.0")
        """
        pass
    
    @abstractmethod
    def get_description(self) -> str:
        """
        Get the agent's description.
        
        Returns:
            Brief description of what the agent reviews
        """
        pass
    
    @abstractmethod
    def get_review_focus_areas(self) -> List[str]:
        """
        Get the specific areas this agent focuses on.
        
        Returns:
            List of focus areas (e.g., ["Meta tags", "Heading hierarchy"])
        """
        pass
    
    @abstractmethod
    def _build_system_prompt(self) -> str:
        """
        Build the system prompt for this agent.
        
        Returns:
            System prompt that defines the agent's role and expertise
        """
        pass
    
    @abstractmethod
    def _build_user_prompt(self, context: ReviewContext) -> str:
        """
        Build the user prompt with review context.
        
        Args:
            context: Review context containing code and specifications
            
        Returns:
            User prompt with all necessary context for review
        """
        pass
    
    @abstractmethod
    def _get_structured_output_schema(self) -> Dict[str, Any]:
        """
        Get the JSON schema for structured output.
        
        Returns:
            OpenAI-compatible JSON schema for response format
        """
        pass
    
    def review(self, context: ReviewContext) -> AgentFeedback:
        """
        Perform review and return structured feedback.
        
        This is the main entry point for agent reviews. It orchestrates
        the review process and returns comprehensive feedback.
        
        Args:
            context: Review context with code and specifications
            
        Returns:
            Structured feedback with actionable items
            
        Raises:
            Exception: If review fails or API call errors
        """
        # Build prompts
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(context)
        
        # Perform review with structured output
        if self.config.enable_structured_output:
            feedback_data = self._review_with_structured_output(
                system_prompt, user_prompt
            )
        else:
            feedback_data = self._review_with_json_mode(
                system_prompt, user_prompt
            )
        
        # Convert to AgentFeedback
        return self._parse_feedback(feedback_data, context.page_name)
    
    def _review_with_structured_output(
        self, system_prompt: str, user_prompt: str
    ) -> Dict[str, Any]:
        """
        Perform review using OpenAI Structured Outputs.
        
        Args:
            system_prompt: System prompt defining agent role
            user_prompt: User prompt with review context
            
        Returns:
            Structured feedback data
        """
        import openai
        
        if not self._client:
            self._client = openai.OpenAI(api_key=self.config.api_key)
        
        # Get schema
        schema = self._get_structured_output_schema()
        
        # Call API with structured output
        response = self._client.chat.completions.create(
            model=self.config.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": f"{self.get_name().replace(' ', '_').lower()}_feedback",
                    "strict": self.config.strict_mode,
                    "schema": schema
                }
            },
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens
        )
        
        # Parse JSON response
        import json
        return json.loads(response.choices[0].message.content)
    
    def _review_with_json_mode(
        self, system_prompt: str, user_prompt: str
    ) -> Dict[str, Any]:
        """
        Fallback: Perform review using JSON mode (less strict).
        
        Args:
            system_prompt: System prompt defining agent role
            user_prompt: User prompt with review context
            
        Returns:
            Feedback data as dictionary
        """
        import openai
        import json
        
        if not self._client:
            self._client = openai.OpenAI(api_key=self.config.api_key)
        
        response = self._client.chat.completions.create(
            model=self.config.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens
        )
        
        return json.loads(response.choices[0].message.content)
    
    def _parse_feedback(
        self, feedback_data: Dict[str, Any], page_name: str
    ) -> AgentFeedback:
        """
        Parse feedback data into AgentFeedback object.
        
        Args:
            feedback_data: Raw feedback data from API
            page_name: Name of the page being reviewed
            
        Returns:
            Structured AgentFeedback object
        """
        # Parse feedback items
        feedback_items = []
        for item_data in feedback_data.get('feedback_items', []):
            feedback_items.append(FeedbackItem(
                category=FeedbackCategory(item_data['category']),
                severity=FeedbackSeverity(item_data['severity']),
                title=item_data['title'],
                description=item_data['description'],
                current_state=item_data['current_state'],
                suggested_improvement=item_data['suggested_improvement'],
                impact=item_data['impact'],
                code_reference=item_data.get('code_reference'),
                line_number=item_data.get('line_number'),
                wcag_criterion=item_data.get('wcag_criterion'),
            ))
        
        return AgentFeedback(
            agent_name=self.get_name(),
            agent_version=self.get_version(),
            review_timestamp=datetime.utcnow().isoformat(),
            page_name=page_name,
            overall_score=feedback_data.get('overall_score', 0.0),
            summary=feedback_data.get('summary', ''),
            feedback_items=feedback_items,
            strengths=feedback_data.get('strengths', []),
            priorities=feedback_data.get('priorities', []),
            metadata=feedback_data.get('metadata', {}),
        )
    
    def get_cost_estimate(self, context: ReviewContext) -> Dict[str, Any]:
        """
        Estimate cost of review.
        
        Args:
            context: Review context
            
        Returns:
            Cost estimate with breakdown
        """
        # Rough token estimation
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(context)
        
        input_chars = len(system_prompt) + len(user_prompt)
        input_tokens = input_chars // 4  # Rough estimate
        output_tokens = self.config.max_tokens
        
        # Cost per 1M tokens (approximate for gpt-4o)
        input_cost_per_1m = 5.00
        output_cost_per_1m = 15.00
        
        input_cost = (input_tokens / 1_000_000) * input_cost_per_1m
        output_cost = (output_tokens / 1_000_000) * output_cost_per_1m
        total_cost = input_cost + output_cost
        
        return {
            'agent_name': self.get_name(),
            'estimated_input_tokens': input_tokens,
            'estimated_output_tokens': output_tokens,
            'estimated_total_tokens': input_tokens + output_tokens,
            'estimated_cost_usd': round(total_cost, 4),
            'breakdown': {
                'input_cost_usd': round(input_cost, 4),
                'output_cost_usd': round(output_cost, 4),
            }
        }
    
    def get_info(self) -> Dict[str, Any]:
        """
        Get agent information.
        
        Returns:
            Dictionary with agent metadata
        """
        return {
            'name': self.get_name(),
            'version': self.get_version(),
            'description': self.get_description(),
            'focus_areas': self.get_review_focus_areas(),
            'model': self.config.model,
            'structured_output_enabled': self.config.enable_structured_output,
        }
