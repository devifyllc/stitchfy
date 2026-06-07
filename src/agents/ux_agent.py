"""
UX Agent

Specialized agent for User Experience review and optimization.
Analyzes layout, navigation, visual hierarchy, and user journey.
"""

from typing import List, Dict, Any

from .base_agent import BaseAgent, AgentConfig, ReviewContext


class UXAgent(BaseAgent):
    """
    UX Agent for user experience optimization.
    
    Focuses on:
    - Navigation clarity and usability
    - Visual hierarchy and layout
    - User flow and journey
    - Mobile responsiveness
    - Interactive elements and CTAs
    - Form usability
    - Content readability
    """
    
    VERSION = "1.0.0"
    
    def get_name(self) -> str:
        return "UX Agent"
    
    def get_version(self) -> str:
        return self.VERSION
    
    def get_description(self) -> str:
        return "Analyzes and optimizes user experience, navigation, and interaction design"
    
    def get_review_focus_areas(self) -> List[str]:
        return [
            "Navigation structure and clarity",
            "Visual hierarchy and layout",
            "Call-to-action placement and design",
            "Mobile responsiveness and touch targets",
            "Form design and usability",
            "Content readability and scannability",
            "User flow and conversion paths",
            "Interactive element feedback",
        ]
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for UX agent"""
        prompt = f"""You are an expert UX designer analyzing web pages for user experience quality.

Your role is to review HTML, CSS, and JavaScript code to identify UX issues and opportunities.

Focus Areas:
1. **Navigation**: Clear, intuitive navigation structure, mobile menu, breadcrumbs
2. **Visual Hierarchy**: Proper use of typography, spacing, contrast to guide attention
3. **Layout**: Grid systems, whitespace, content organization, responsive design
4. **CTAs**: Clear, prominent calls-to-action with good contrast and placement
5. **Mobile UX**: Touch targets (min 44x44px), responsive breakpoints, mobile-first design
6. **Forms**: Clear labels, validation, error messages, logical field order
7. **Readability**: Font sizes, line height, paragraph width, content structure
8. **Interaction**: Hover states, loading states, feedback for user actions

Evaluation Criteria:
- **Critical**: Broken navigation, unusable on mobile, critical UX failures
- **High**: Poor visual hierarchy, unclear CTAs, significant usability issues
- **Medium**: Layout improvements, spacing issues, minor UX enhancements
- **Low**: Polish and refinements, advanced UX patterns
- **Info**: Best practices, UX recommendations

Provide specific, actionable feedback with design rationale and implementation suggestions."""

        if self.config.custom_instructions:
            prompt += f"\n\nAdditional Instructions:\n{self.config.custom_instructions}"
        
        return prompt
    
    def _build_user_prompt(self, context: ReviewContext) -> str:
        """Build user prompt with review context"""
        prompt_parts = [
            f"Review the following web page for user experience quality:",
            f"",
            f"**Page Name:** {context.page_name}",
            f"",
        ]
        
        if context.target_audience:
            prompt_parts.extend([
                f"**Target Audience:**",
                f"{context.target_audience}",
                f"",
            ])
        
        if context.conversion_goals:
            prompt_parts.extend([
                f"**Conversion Goals:**",
                f"{context.conversion_goals}",
                f"",
            ])
        
        prompt_parts.extend([
            f"**HTML Code:**",
            f"```html",
            f"{context.html}",
            f"```",
            f"",
            f"**CSS Code:**",
            f"```css",
            f"{context.css[:3000] if context.css else 'No CSS provided'}...",
            f"```",
            f"",
        ])
        
        if context.javascript:
            prompt_parts.extend([
                f"**JavaScript Code:**",
                f"```javascript",
                f"{context.javascript[:1000]}...",
                f"```",
                f"",
            ])
        
        prompt_parts.extend([
            f"Analyze this page and provide:",
            f"1. Overall UX score (0-100)",
            f"2. Specific UX issues with severity levels",
            f"3. Strengths and what's working well",
            f"4. Top 3-5 priority improvements",
            f"5. Actionable recommendations with design rationale",
            f"",
            f"Return your analysis as structured JSON following the schema.",
        ])
        
        return "\n".join(prompt_parts)
    
    def _get_structured_output_schema(self) -> Dict[str, Any]:
        """Get JSON schema for structured output"""
        return {
            "type": "object",
            "properties": {
                "overall_score": {
                    "type": "number",
                    "description": "Overall UX score from 0-100"
                },
                "summary": {
                    "type": "string",
                    "description": "Brief summary of UX analysis"
                },
                "strengths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of UX strengths found in the page"
                },
                "priorities": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Top 3-5 priority improvements"
                },
                "feedback_items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "enum": [
                                    "ux_navigation",
                                    "ux_layout",
                                    "ux_interaction",
                                    "ux_visual_hierarchy",
                                    "ux_mobile"
                                ],
                                "description": "Category of the UX issue"
                            },
                            "severity": {
                                "type": "string",
                                "enum": ["critical", "high", "medium", "low", "info"],
                                "description": "Severity level of the issue"
                            },
                            "title": {
                                "type": "string",
                                "description": "Short title of the issue"
                            },
                            "description": {
                                "type": "string",
                                "description": "Detailed description of the UX issue"
                            },
                            "current_state": {
                                "type": "string",
                                "description": "Current UX state or what's wrong"
                            },
                            "suggested_improvement": {
                                "type": "string",
                                "description": "Specific UX improvement suggestion"
                            },
                            "impact": {
                                "type": "string",
                                "description": "Expected impact on user experience"
                            },
                            "code_reference": {
                                "type": "string",
                                "description": "Code snippet or reference"
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
                        "has_mobile_viewport": {"type": "boolean"},
                        "has_responsive_design": {"type": "boolean"},
                        "cta_count": {"type": "integer"},
                        "form_count": {"type": "integer"}
                    },
                    "required": ["has_mobile_viewport", "has_responsive_design", "cta_count", "form_count"],
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
