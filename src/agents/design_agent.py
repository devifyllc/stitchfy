"""
Design Agent

Analyzes and optimizes visual design, CSS quality, and aesthetic appeal.
Focuses on modern design principles, beautiful styling, and visual polish.
"""

from typing import Dict, Any
from .base_agent import BaseAgent, AgentFeedback, FeedbackCategory


class DesignAgent(BaseAgent):
    """
    Agent specialized in visual design and frontend aesthetics.
    
    Analyzes:
    - Color schemes and palettes
    - Typography and font usage
    - Visual hierarchy and spacing
    - Modern CSS techniques
    - Component design quality
    - Animations and transitions
    - Overall visual polish
    """
    
    def get_name(self) -> str:
        return "Design Agent"
    
    def get_version(self) -> str:
        return "1.0.0"
    
    def get_description(self) -> str:
        return "Analyzes and optimizes visual design, CSS quality, and aesthetic appeal"
    
    def get_focus_areas(self) -> list[str]:
        return [
            "Color schemes and palette harmony",
            "Typography and font pairings",
            "Visual hierarchy and spacing",
            "Modern CSS techniques (Grid, Flexbox, Custom Properties)",
            "Component design (cards, buttons, forms)",
            "Animations and micro-interactions",
            "Shadows, borders, and visual depth",
            "Responsive design aesthetics",
        ]
    
    def _build_system_prompt(self) -> str:
        return """You are an expert visual designer and frontend specialist analyzing web pages for design quality and aesthetic appeal.

Your role is to evaluate:

1. COLOR & AESTHETICS
   - Color palette harmony and consistency
   - Gradient usage and quality
   - Brand color implementation
   - Visual contrast for aesthetics (not just accessibility)
   - Color psychology and emotional impact

2. TYPOGRAPHY
   - Font choices and pairings
   - Font sizes and hierarchy
   - Line height and letter spacing
   - Readability and visual appeal
   - Web font implementation

3. VISUAL HIERARCHY
   - Spacing and whitespace usage
   - Visual weight and emphasis
   - Layout balance and composition
   - Grid and alignment
   - Visual flow

4. MODERN CSS
   - CSS Grid and Flexbox usage
   - CSS Custom Properties (variables)
   - Modern selectors and techniques
   - CSS organization and structure
   - Performance and optimization

5. COMPONENT DESIGN
   - Button design and states
   - Card design and elevation
   - Form element styling
   - Navigation design
   - Icon usage and quality

6. POLISH & DETAILS
   - Shadows and depth
   - Border radius and shapes
   - Transitions and animations
   - Hover and focus states
   - Micro-interactions

7. RESPONSIVE AESTHETICS
   - Mobile-first design quality
   - Breakpoint implementation
   - Responsive typography
   - Touch-friendly design
   - Cross-device consistency

8. MODERN TRENDS
   - Contemporary design patterns
   - Glassmorphism, neumorphism, etc.
   - Dark mode considerations
   - Minimalism vs. richness balance
   - Industry best practices

Provide specific, actionable feedback with CSS code examples.
Focus on making the page visually stunning and professionally designed."""
    
    def _build_user_prompt(self, context) -> str:
        return f"""Analyze this web page for visual design quality and aesthetic appeal.

HTML:
{context.html[:3000]}

CSS:
{context.css[:3000]}

JavaScript:
{context.javascript[:1000]}

Evaluate the visual design across all focus areas and provide detailed feedback.
Focus on what would make this page truly beautiful and professionally designed.

Consider:
- Is the color scheme modern and appealing?
- Is the typography professional and readable?
- Are components well-designed with proper spacing?
- Does it use modern CSS techniques?
- Are there animations and transitions?
- Is the visual hierarchy clear?
- Does it look polished and professional?

Provide specific CSS improvements with code examples."""
    
    def _get_structured_output_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "overall_score": {
                    "type": "number",
                    "description": "Overall design quality score from 0-100"
                },
                "summary": {
                    "type": "string",
                    "description": "Brief summary of design quality"
                },
                "strengths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Design strengths and good practices"
                },
                "priorities": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Top 3-5 design improvements needed"
                },
                "feedback_items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "enum": [
                                    "design_color",
                                    "design_typography",
                                    "design_spacing",
                                    "design_components",
                                    "design_animations",
                                    "design_css_modern",
                                    "design_visual_hierarchy",
                                    "design_responsive"
                                ],
                                "description": "Design category"
                            },
                            "severity": {
                                "type": "string",
                                "enum": ["critical", "high", "medium", "low"],
                                "description": "Issue severity"
                            },
                            "title": {
                                "type": "string",
                                "description": "Issue title"
                            },
                            "description": {
                                "type": "string",
                                "description": "Detailed description"
                            },
                            "current_state": {
                                "type": "string",
                                "description": "Current design state"
                            },
                            "suggested_improvement": {
                                "type": "string",
                                "description": "Specific CSS/design improvement with code"
                            },
                            "impact": {
                                "type": "string",
                                "description": "Visual impact of the improvement"
                            },
                            "code_reference": {
                                "type": "string",
                                "description": "CSS code example or reference"
                            }
                        },
                        "required": [
                            "category",
                            "severity",
                            "title",
                            "description",
                            "current_state",
                            "suggested_improvement",
                            "impact",
                            "code_reference"
                        ],
                        "additionalProperties": False
                    }
                },
                "metadata": {
                    "type": "object",
                    "properties": {
                        "uses_modern_css": {"type": "boolean"},
                        "has_animations": {"type": "boolean"},
                        "has_custom_properties": {"type": "boolean"},
                        "color_palette_count": {"type": "integer"},
                        "font_count": {"type": "integer"},
                        "has_gradients": {"type": "boolean"}
                    },
                    "required": ["uses_modern_css", "has_animations", "has_custom_properties", "color_palette_count", "font_count", "has_gradients"],
                    "additionalProperties": False
                }
            },
            "required": [
                "overall_score",
                "summary",
                "strengths",
                "priorities",
                "feedback_items",
                "metadata"
            ],
            "additionalProperties": False
        }
    
    def get_review_focus_areas(self) -> list[str]:
        """Get specific areas this agent reviews"""
        return self.get_focus_areas()
    
    def _create_feedback_from_response(self, response_data: Dict[str, Any]) -> AgentFeedback:
        """Create AgentFeedback from API response"""
        from .base_agent import FeedbackItem, FeedbackSeverity
        
        # Map category strings to FeedbackCategory enum
        category_map = {
            "design_color": FeedbackCategory.DESIGN_COLOR,
            "design_typography": FeedbackCategory.DESIGN_TYPOGRAPHY,
            "design_spacing": FeedbackCategory.DESIGN_SPACING,
            "design_components": FeedbackCategory.DESIGN_COMPONENTS,
            "design_animations": FeedbackCategory.DESIGN_ANIMATIONS,
            "design_css_modern": FeedbackCategory.DESIGN_CSS_MODERN,
            "design_visual_hierarchy": FeedbackCategory.DESIGN_VISUAL_HIERARCHY,
            "design_responsive": FeedbackCategory.DESIGN_RESPONSIVE,
        }
        
        # Map severity strings to FeedbackSeverity enum
        severity_map = {
            "critical": FeedbackSeverity.CRITICAL,
            "high": FeedbackSeverity.HIGH,
            "medium": FeedbackSeverity.MEDIUM,
            "low": FeedbackSeverity.LOW,
        }
        
        # Convert feedback items
        feedback_items = []
        for item in response_data.get("feedback_items", []):
            feedback_items.append(FeedbackItem(
                category=category_map.get(item["category"], FeedbackCategory.DESIGN_COLOR),
                severity=severity_map.get(item["severity"], FeedbackSeverity.MEDIUM),
                title=item["title"],
                description=item["description"],
                current_state=item["current_state"],
                suggested_improvement=item["suggested_improvement"],
                impact=item["impact"],
                code_reference=item.get("code_reference", "")
            ))
        
        return AgentFeedback(
            agent_name=self.get_name(),
            agent_version=self.get_version(),
            overall_score=response_data["overall_score"],
            summary=response_data["summary"],
            strengths=response_data.get("strengths", []),
            priorities=response_data.get("priorities", []),
            feedback_items=feedback_items,
            metadata=response_data.get("metadata", {})
        )
