"""
Accessibility Agent

Specialized agent for WCAG compliance and accessibility review.
Analyzes semantic HTML, ARIA attributes, keyboard navigation, and color contrast.
"""

from typing import List, Dict, Any

from .base_agent import BaseAgent, AgentConfig, ReviewContext


class AccessibilityAgent(BaseAgent):
    """
    Accessibility Agent for WCAG compliance review.
    
    Focuses on:
    - WCAG 2.1 Level AA compliance
    - Semantic HTML structure
    - ARIA attributes and roles
    - Keyboard navigation
    - Color contrast ratios
    - Form accessibility
    - Screen reader compatibility
    """
    
    VERSION = "1.0.0"
    
    def get_name(self) -> str:
        return "Accessibility Agent"
    
    def get_version(self) -> str:
        return self.VERSION
    
    def get_description(self) -> str:
        return "Analyzes and ensures WCAG 2.1 Level AA accessibility compliance"
    
    def get_review_focus_areas(self) -> List[str]:
        return [
            "WCAG 2.1 Level AA compliance",
            "Semantic HTML elements",
            "ARIA roles, states, and properties",
            "Keyboard navigation and focus management",
            "Color contrast ratios (4.5:1 for text)",
            "Form labels and error messages",
            "Alternative text for images",
            "Screen reader compatibility",
        ]
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for accessibility agent"""
        prompt = f"""You are an expert accessibility specialist analyzing web pages for WCAG 2.1 Level AA compliance.

Your role is to review HTML, CSS, and JavaScript code to identify accessibility barriers and ensure inclusive design.

Focus Areas:
1. **Semantic HTML**: Proper use of semantic elements (header, nav, main, article, aside, footer)
2. **ARIA**: Correct use of ARIA roles, states, and properties (only when semantic HTML is insufficient)
3. **Keyboard Navigation**: Tab order, focus indicators, keyboard shortcuts, skip links
4. **Color Contrast**: 4.5:1 for normal text, 3:1 for large text and UI components
5. **Forms**: Labels, fieldsets, error messages, required field indicators
6. **Images**: Alt text, decorative images (alt=""), complex images with descriptions
7. **Headings**: Logical heading hierarchy (H1-H6), no skipped levels
8. **Interactive Elements**: Buttons vs links, focus states, disabled states

WCAG 2.1 Level AA Success Criteria:
- 1.1.1 Non-text Content
- 1.3.1 Info and Relationships
- 1.4.3 Contrast (Minimum)
- 2.1.1 Keyboard
- 2.4.1 Bypass Blocks
- 2.4.2 Page Titled
- 2.4.6 Headings and Labels
- 3.2.3 Consistent Navigation
- 3.3.1 Error Identification
- 3.3.2 Labels or Instructions
- 4.1.2 Name, Role, Value

Evaluation Criteria:
- **Critical**: WCAG violations, content inaccessible to screen readers, keyboard traps
- **High**: Missing alt text, poor contrast, missing form labels
- **Medium**: Suboptimal ARIA usage, heading hierarchy issues
- **Low**: Enhancement opportunities, best practices
- **Info**: Recommendations, advanced accessibility features

Always cite specific WCAG success criteria (e.g., "WCAG 2.1 1.4.3 Contrast (Minimum)")."""

        if self.config.custom_instructions:
            prompt += f"\n\nAdditional Instructions:\n{self.config.custom_instructions}"
        
        return prompt
    
    def _build_user_prompt(self, context: ReviewContext) -> str:
        """Build user prompt with review context"""
        prompt_parts = [
            f"Review the following web page for WCAG 2.1 Level AA accessibility compliance:",
            f"",
            f"**Page Name:** {context.page_name}",
            f"",
            f"**HTML Code:**",
            f"```html",
            f"{context.html}",
            f"```",
            f"",
        ]
        
        if context.css:
            prompt_parts.extend([
                f"**CSS Code (for color contrast analysis):**",
                f"```css",
                f"{context.css[:2000]}...",
                f"```",
                f"",
            ])
        
        prompt_parts.extend([
            f"Analyze this page and provide:",
            f"1. Overall accessibility score (0-100)",
            f"2. Specific WCAG violations and issues with severity levels",
            f"3. Strengths and accessible features",
            f"4. Top 3-5 priority improvements with WCAG criteria references",
            f"5. Actionable recommendations with code examples",
            f"",
            f"For each issue, cite the relevant WCAG 2.1 success criterion.",
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
                    "description": "Overall accessibility score from 0-100"
                },
                "summary": {
                    "type": "string",
                    "description": "Brief summary of accessibility analysis"
                },
                "strengths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of accessibility strengths"
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
                                    "a11y_semantic",
                                    "a11y_aria",
                                    "a11y_keyboard",
                                    "a11y_color_contrast",
                                    "a11y_forms"
                                ],
                                "description": "Category of the accessibility issue"
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
                                "description": "Detailed description of the accessibility issue"
                            },
                            "current_state": {
                                "type": "string",
                                "description": "Current state or what's wrong"
                            },
                            "suggested_improvement": {
                                "type": "string",
                                "description": "Specific improvement suggestion with code example"
                            },
                            "impact": {
                                "type": "string",
                                "description": "Impact on users with disabilities"
                            },
                            "wcag_criterion": {
                                "type": "string",
                                "description": "WCAG 2.1 success criterion (e.g., '1.4.3 Contrast (Minimum)')"
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
                            "wcag_criterion",
                            "code_reference"
                        ],
                        "additionalProperties": False
                    }
                },
                "metadata": {
                    "type": "object",
                    "properties": {
                        "has_lang_attribute": {"type": "boolean"},
                        "has_skip_link": {"type": "boolean"},
                        "has_landmark_regions": {"type": "boolean"},
                        "images_without_alt": {"type": "integer"},
                        "form_inputs_without_labels": {"type": "integer"}
                    },
                    "required": ["has_lang_attribute", "has_skip_link", "has_landmark_regions", "images_without_alt", "form_inputs_without_labels"],
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
