# Stitchfy Agent Architecture

## Overview

The Stitchfy Agent System is a multi-agent architecture for automated review and optimization of AI-generated websites. It uses specialized AI agents to provide comprehensive feedback across SEO, UX, Accessibility, and Marketing domains.

## Architecture Principles

### 1. **Separation of Concerns**
Each agent specializes in a specific domain:
- **SEO Agent**: Search engine optimization
- **UX Agent**: User experience and interaction design
- **Accessibility Agent**: WCAG 2.1 Level AA compliance
- **Marketing Agent**: Conversion optimization and messaging

### 2. **Structured Output**
All agents use OpenAI's Structured Outputs feature for:
- Type-safe, reliable feedback
- Consistent JSON schema across agents
- Automatic validation of responses
- Easier parsing and processing

### 3. **Parallel Execution**
The orchestrator runs agents in parallel for:
- Faster review cycles
- Independent agent operation
- Scalable architecture

### 4. **Extensibility**
Easy to add new agents by:
- Extending `BaseAgent` abstract class
- Implementing required methods
- Registering with orchestrator

## Core Components

### BaseAgent (Abstract Class)

The foundation for all agents. Defines the interface and common functionality.

**Key Methods:**
```python
class BaseAgent(ABC):
    @abstractmethod
    def get_name(self) -> str
    
    @abstractmethod
    def get_version(self) -> str
    
    @abstractmethod
    def get_description(self) -> str
    
    @abstractmethod
    def get_review_focus_areas(self) -> List[str]
    
    @abstractmethod
    def _build_system_prompt(self) -> str
    
    @abstractmethod
    def _build_user_prompt(self, context: ReviewContext) -> str
    
    @abstractmethod
    def _get_structured_output_schema(self) -> Dict[str, Any]
    
    def review(self, context: ReviewContext) -> AgentFeedback
```

**Common Functionality:**
- API client management
- Structured output handling
- Cost estimation
- Error handling
- Feedback parsing

### Data Models

#### ReviewContext
Input data provided to agents:
```python
@dataclass
class ReviewContext:
    html: str
    css: str
    javascript: str
    page_name: str
    project_spec: Optional[str]
    brand_guidelines: Optional[str]
    target_audience: Optional[str]
    conversion_goals: Optional[str]
    metadata: Dict[str, Any]
```

#### FeedbackItem
Individual piece of feedback:
```python
@dataclass
class FeedbackItem:
    category: FeedbackCategory
    severity: FeedbackSeverity
    title: str
    description: str
    current_state: str
    suggested_improvement: str
    impact: str
    code_reference: Optional[str]
    line_number: Optional[int]
    wcag_criterion: Optional[str]  # For accessibility
```

#### AgentFeedback
Complete feedback from one agent:
```python
@dataclass
class AgentFeedback:
    agent_name: str
    agent_version: str
    review_timestamp: str
    page_name: str
    overall_score: float  # 0-100
    summary: str
    feedback_items: List[FeedbackItem]
    strengths: List[str]
    priorities: List[str]
    metadata: Dict[str, Any]
```

#### ReviewResult
Aggregated results from all agents:
```python
@dataclass
class ReviewResult:
    page_name: str
    review_timestamp: str
    agent_feedbacks: List[AgentFeedback]
    overall_score: float
    total_feedback_items: int
    critical_items_count: int
    high_priority_items_count: int
    summary: str
    top_priorities: List[str]
    metadata: Dict[str, Any]
```

### Severity Levels

```python
class FeedbackSeverity(str, Enum):
    CRITICAL = "critical"  # Must fix - breaks functionality/compliance
    HIGH = "high"          # Should fix - significant impact
    MEDIUM = "medium"      # Nice to have - moderate improvement
    LOW = "low"            # Optional - minor enhancement
    INFO = "info"          # Informational - no action required
```

### Feedback Categories

Organized by domain:

**SEO:**
- `seo_metadata` - Meta tags, Open Graph
- `seo_structure` - Heading hierarchy, semantic HTML
- `seo_content` - Keywords, content quality
- `seo_performance` - Page speed, optimization

**UX:**
- `ux_navigation` - Navigation structure
- `ux_layout` - Grid, spacing, organization
- `ux_interaction` - Interactive elements
- `ux_visual_hierarchy` - Typography, contrast
- `ux_mobile` - Responsive design

**Accessibility:**
- `a11y_semantic` - Semantic HTML
- `a11y_aria` - ARIA attributes
- `a11y_keyboard` - Keyboard navigation
- `a11y_color_contrast` - Color contrast ratios
- `a11y_forms` - Form accessibility

**Marketing:**
- `marketing_copy` - Copywriting quality
- `marketing_cta` - Call-to-action effectiveness
- `marketing_value_prop` - Value proposition clarity
- `marketing_trust` - Trust signals
- `marketing_conversion` - Conversion optimization

## Agent Implementations

### SEO Agent

**Focus Areas:**
- Meta tags (title, description, Open Graph)
- Heading hierarchy (H1-H6)
- Semantic HTML structure
- Keyword optimization
- Schema.org markup
- Image alt text
- Performance indicators

**Scoring Criteria:**
- Title tag present and optimized
- Meta description compelling and within limits
- Proper heading hierarchy
- Semantic HTML usage
- Image optimization

### UX Agent

**Focus Areas:**
- Navigation clarity and structure
- Visual hierarchy and layout
- Call-to-action placement
- Mobile responsiveness
- Form usability
- Content readability
- User flow optimization

**Scoring Criteria:**
- Clear navigation structure
- Proper visual hierarchy
- Mobile-friendly design
- Touch targets ≥44x44px
- Readable typography

### Accessibility Agent

**Focus Areas:**
- WCAG 2.1 Level AA compliance
- Semantic HTML
- ARIA roles and attributes
- Keyboard navigation
- Color contrast (4.5:1 minimum)
- Form labels
- Screen reader compatibility

**Scoring Criteria:**
- All WCAG 2.1 AA criteria met
- Proper semantic structure
- Keyboard accessible
- Sufficient color contrast
- Form labels present

### Marketing Agent

**Focus Areas:**
- Value proposition clarity
- CTA effectiveness
- Trust signals and credibility
- Persuasive copywriting
- Social proof
- Conversion funnel
- Benefit-focused messaging

**Scoring Criteria:**
- Clear value proposition
- Strong, action-oriented CTAs
- Trust signals present
- Benefit-focused copy
- Social proof elements

## Review Orchestrator

Coordinates multiple agents for comprehensive reviews.

**Key Features:**
- Parallel execution with ThreadPoolExecutor
- Graceful error handling (continues if one agent fails)
- Result aggregation and prioritization
- Cost estimation across all agents
- Markdown report generation

**Usage:**
```python
from src.agents import (
    SEOAgent, UXAgent, AccessibilityAgent, MarketingAgent,
    ReviewOrchestrator, ReviewContext, AgentConfig
)

# Create agent config
config = AgentConfig(
    api_key="your-api-key",
    model="gpt-4o",
    temperature=0.3,
    max_tokens=4000
)

# Initialize agents
agents = [
    SEOAgent(config),
    UXAgent(config),
    AccessibilityAgent(config),
    MarketingAgent(config),
]

# Create orchestrator
orchestrator = ReviewOrchestrator(agents, max_workers=4)

# Prepare review context
context = ReviewContext(
    html=html_code,
    css=css_code,
    javascript=js_code,
    page_name="home",
    target_audience="Small business owners",
    conversion_goals="Book discovery call"
)

# Run review
result = orchestrator.review(context, parallel=True)

# Access results
print(f"Overall Score: {result.overall_score}/100")
print(f"Critical Issues: {result.critical_items_count}")

# Generate report
markdown_report = result.generate_markdown_report()

# Save results
result.save_to_file("output/reviews/home_review.json")
```

## Workflow

### 1. Review Phase
```
User generates UI
    ↓
Create ReviewContext with HTML/CSS/JS
    ↓
Initialize agents with config
    ↓
Orchestrator runs agents in parallel
    ↓
Each agent:
  - Builds system prompt (role definition)
  - Builds user prompt (code + context)
  - Calls OpenAI with structured output
  - Parses response into AgentFeedback
    ↓
Orchestrator aggregates results
    ↓
Return ReviewResult with all feedback
```

### 2. Refinement Phase (Future)
```
ReviewResult
    ↓
Extract high-priority items
    ↓
Generate refinement prompt
    ↓
Regenerate UI with improvements
    ↓
Run review again
    ↓
Compare scores
    ↓
Iterate until threshold met
```

## Structured Output Schema

Each agent returns JSON matching this structure:

```json
{
  "overall_score": 85.5,
  "summary": "Good SEO foundation with some optimization opportunities",
  "strengths": [
    "Proper heading hierarchy",
    "Semantic HTML structure"
  ],
  "priorities": [
    "Add meta description",
    "Optimize title tag length",
    "Add schema markup"
  ],
  "feedback_items": [
    {
      "category": "seo_metadata",
      "severity": "high",
      "title": "Missing meta description",
      "description": "The page lacks a meta description tag...",
      "current_state": "No meta description present",
      "suggested_improvement": "Add: <meta name=\"description\" content=\"...\">",
      "impact": "Improves click-through rate from search results",
      "code_reference": "<head> section"
    }
  ],
  "metadata": {
    "has_title_tag": true,
    "has_meta_description": false,
    "has_h1": true
  }
}
```

## Cost Estimation

Each agent provides cost estimates:

```python
estimate = agent.get_cost_estimate(context)
# Returns:
{
    'agent_name': 'SEO Agent',
    'estimated_input_tokens': 2500,
    'estimated_output_tokens': 4000,
    'estimated_total_tokens': 6500,
    'estimated_cost_usd': 0.0425,
    'breakdown': {
        'input_cost_usd': 0.0125,
        'output_cost_usd': 0.0300
    }
}
```

Orchestrator provides total cost:
```python
total_estimate = orchestrator.get_cost_estimate(context)
# Returns aggregated cost across all agents
```

## Error Handling

The system is designed to be resilient:

1. **Agent Failures**: If one agent fails, others continue
2. **API Errors**: Graceful degradation with error messages
3. **Schema Validation**: Structured outputs ensure valid responses
4. **Fallback Mode**: Can use JSON mode if structured output unavailable

## Extensibility

### Adding a New Agent

1. **Create agent class:**
```python
from src.agents.base_agent import BaseAgent, AgentConfig, ReviewContext

class PerformanceAgent(BaseAgent):
    VERSION = "1.0.0"
    
    def get_name(self) -> str:
        return "Performance Agent"
    
    def get_version(self) -> str:
        return self.VERSION
    
    def get_description(self) -> str:
        return "Analyzes page performance and Core Web Vitals"
    
    def get_review_focus_areas(self) -> List[str]:
        return ["LCP", "FID", "CLS", "TTFB"]
    
    def _build_system_prompt(self) -> str:
        return "You are a web performance expert..."
    
    def _build_user_prompt(self, context: ReviewContext) -> str:
        return f"Analyze performance of: {context.html}"
    
    def _get_structured_output_schema(self) -> Dict[str, Any]:
        return {...}  # Define schema
```

2. **Register with orchestrator:**
```python
agents = [
    SEOAgent(config),
    UXAgent(config),
    AccessibilityAgent(config),
    MarketingAgent(config),
    PerformanceAgent(config),  # New agent
]
```

## Future Enhancements

### Planned Features

1. **Iterative Refinement Loop**
   - Automatic prompt refinement based on feedback
   - Multi-iteration improvement cycles
   - Score tracking across iterations

2. **Agent Specialization**
   - Industry-specific agents (e-commerce, SaaS, etc.)
   - Custom agent training
   - Domain-specific scoring

3. **Advanced Orchestration**
   - Agent dependencies (run SEO after UX)
   - Conditional agent execution
   - Priority-based scheduling

4. **Feedback Aggregation**
   - Conflict resolution between agents
   - Weighted scoring by agent
   - ML-based prioritization

5. **Integration**
   - CLI commands for review
   - VS Code extension integration
   - CI/CD pipeline integration

## Best Practices

### For Agent Development

1. **Clear System Prompts**: Define role and expertise clearly
2. **Specific Schemas**: Use strict schemas for reliable output
3. **Actionable Feedback**: Always provide concrete suggestions
4. **Code Examples**: Include code snippets in suggestions
5. **Impact Statements**: Explain why each improvement matters

### For Agent Usage

1. **Provide Context**: Include project specs and brand guidelines
2. **Run in Parallel**: Use parallel execution for speed
3. **Review Priorities**: Focus on critical and high severity items
4. **Iterate**: Run reviews after implementing changes
5. **Track Costs**: Monitor API usage and costs

## Summary

The Stitchfy Agent Architecture provides:

✅ **Modular Design**: Easy to extend and customize
✅ **Type Safety**: Structured outputs ensure reliability
✅ **Parallel Execution**: Fast, efficient reviews
✅ **Comprehensive Coverage**: SEO, UX, A11y, Marketing
✅ **Actionable Feedback**: Specific, implementable suggestions
✅ **Production Ready**: Error handling, cost tracking, reporting

This architecture enables automated, comprehensive website reviews that match or exceed human expert quality while being faster, more consistent, and scalable.
