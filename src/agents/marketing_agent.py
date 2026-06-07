"""
Marketing Agent

Specialized agent for marketing copy, messaging, and conversion optimization.
Analyzes value propositions, CTAs, trust signals, and persuasive elements.
"""

from typing import List, Dict, Any

from .base_agent import BaseAgent, AgentConfig, ReviewContext


class MarketingAgent(BaseAgent):
    """
    Marketing Agent for conversion optimization and messaging.
    
    Focuses on:
    - Value proposition clarity
    - Call-to-action effectiveness
    - Trust signals and credibility
    - Persuasive copywriting
    - Conversion funnel optimization
    - Social proof elements
    - Urgency and scarcity tactics
    """
    
    VERSION = "1.0.0"
    
    def get_name(self) -> str:
        return "Marketing Agent"
    
    def get_version(self) -> str:
        return self.VERSION
    
    def get_description(self) -> str:
        return "Analyzes and optimizes marketing copy, CTAs, and conversion elements"
    
    def get_review_focus_areas(self) -> List[str]:
        return [
            "Value proposition clarity and strength",
            "Call-to-action copy and placement",
            "Trust signals and credibility markers",
            "Persuasive copywriting techniques",
            "Social proof (testimonials, reviews, logos)",
            "Conversion funnel optimization",
            "Headline and subheadline effectiveness",
            "Benefit-focused messaging",
        ]
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for marketing agent"""
        prompt = f"""You are an expert marketing strategist and conversion optimization specialist analyzing web pages.

Your role is to review HTML content to identify marketing and conversion opportunities.

Focus Areas:
1. **Value Proposition**: Clear, compelling, benefit-focused messaging
2. **Headlines**: Attention-grabbing, benefit-driven, specific
3. **CTAs**: Action-oriented, high-contrast, strategically placed
4. **Trust Signals**: Testimonials, reviews, client logos, certifications, guarantees
5. **Social Proof**: Customer count, ratings, case studies, media mentions
6. **Copy Quality**: Clear, concise, benefit-focused, persuasive
7. **Conversion Elements**: Forms, pricing, urgency/scarcity, risk reversal
8. **Messaging Hierarchy**: Primary message → supporting points → proof → CTA

Copywriting Principles:
- Features tell, benefits sell
- Speak to pain points and desires
- Use specific numbers and results
- Create urgency without being pushy
- Build trust before asking for action
- Make CTAs clear and compelling

Evaluation Criteria:
- **Critical**: Missing or unclear value proposition, no clear CTA
- **High**: Weak messaging, poor CTA placement, missing trust signals
- **Medium**: Copy improvements, additional social proof opportunities
- **Low**: Polish and refinements, advanced persuasion techniques
- **Info**: Best practices, marketing recommendations

Provide specific, actionable feedback with improved copy examples and marketing rationale."""

        if self.config.custom_instructions:
            prompt += f"\n\nAdditional Instructions:\n{self.config.custom_instructions}"
        
        return prompt
    
    def _build_user_prompt(self, context: ReviewContext) -> str:
        """Build user prompt with review context"""
        prompt_parts = [
            f"Review the following web page for marketing effectiveness and conversion optimization:",
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
        
        if context.brand_guidelines:
            prompt_parts.extend([
                f"**Brand Guidelines:**",
                f"{context.brand_guidelines}",
                f"",
            ])
        
        prompt_parts.extend([
            f"**HTML Code:**",
            f"```html",
            f"{context.html}",
            f"```",
            f"",
            f"Analyze this page and provide:",
            f"1. Overall marketing effectiveness score (0-100)",
            f"2. Specific marketing and conversion issues",
            f"3. Strengths and what's working well",
            f"4. Top 3-5 priority improvements",
            f"5. Improved copy suggestions with marketing rationale",
            f"",
            f"Focus on:",
            f"- Is the value proposition clear and compelling?",
            f"- Are CTAs prominent and action-oriented?",
            f"- Does the copy focus on benefits over features?",
            f"- Are there sufficient trust signals?",
            f"- Is the messaging aligned with the target audience?",
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
                    "description": "Overall marketing effectiveness score from 0-100"
                },
                "summary": {
                    "type": "string",
                    "description": "Brief summary of marketing analysis"
                },
                "strengths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of marketing strengths"
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
                                    "marketing_copy",
                                    "marketing_cta",
                                    "marketing_value_prop",
                                    "marketing_trust",
                                    "marketing_conversion"
                                ],
                                "description": "Category of the marketing issue"
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
                                "description": "Detailed description of the marketing issue"
                            },
                            "current_state": {
                                "type": "string",
                                "description": "Current copy or marketing element"
                            },
                            "suggested_improvement": {
                                "type": "string",
                                "description": "Improved copy or marketing suggestion"
                            },
                            "impact": {
                                "type": "string",
                                "description": "Expected impact on conversions"
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
                        "has_clear_value_prop": {"type": "boolean"},
                        "cta_count": {"type": "integer"},
                        "trust_signal_count": {"type": "integer"},
                        "testimonial_count": {"type": "integer"}
                    },
                    "required": ["has_clear_value_prop", "cta_count", "trust_signal_count", "testimonial_count"],
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
