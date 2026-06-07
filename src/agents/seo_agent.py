"""
SEO Agent

Specialized agent for Search Engine Optimization review and recommendations.
Analyzes HTML structure, metadata, semantic markup, and content optimization.
"""

from typing import List, Dict, Any

from .base_agent import BaseAgent, AgentConfig, ReviewContext


class SEOAgent(BaseAgent):
    """
    SEO Agent for search engine optimization review.
    
    Focuses on:
    - Meta tags and descriptions
    - Heading hierarchy (H1-H6)
    - Semantic HTML structure
    - Keyword optimization
    - URL structure and internal linking
    - Schema markup
    - Performance and Core Web Vitals
    """
    
    VERSION = "1.0.0"
    
    def get_name(self) -> str:
        return "SEO Agent"
    
    def get_version(self) -> str:
        return self.VERSION
    
    def get_description(self) -> str:
        return "Analyzes and optimizes pages for search engine visibility and ranking"
    
    def get_review_focus_areas(self) -> List[str]:
        return [
            "Meta tags (title, description, Open Graph)",
            "Heading hierarchy and structure",
            "Semantic HTML elements",
            "Keyword optimization and density",
            "Internal linking structure",
            "Schema.org structured data",
            "Image alt text and optimization",
            "Page performance indicators",
        ]
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for SEO agent"""
        prompt = f"""You are an expert SEO specialist analyzing web pages for search engine optimization.

Your role is to review HTML, CSS, and JavaScript code to identify SEO issues and opportunities.

Focus Areas:
1. **Meta Tags**: Title tags, meta descriptions, Open Graph, Twitter Cards
2. **Heading Structure**: Proper H1-H6 hierarchy, keyword usage
3. **Semantic HTML**: Use of semantic elements (header, nav, main, article, section, footer)
4. **Content Optimization**: Keyword placement, content quality, readability
5. **Technical SEO**: URL structure, canonical tags, robots directives
6. **Schema Markup**: Structured data for rich snippets
7. **Performance**: Page speed indicators, image optimization
8. **Mobile SEO**: Mobile-friendliness, viewport configuration

Evaluation Criteria:
- **Critical**: Missing title/description, broken structure, major indexing issues
- **High**: Suboptimal meta tags, poor heading hierarchy, missing schema
- **Medium**: Keyword optimization opportunities, minor structural issues
- **Low**: Enhancement opportunities, advanced optimizations
- **Info**: Best practices, recommendations

Provide specific, actionable feedback with code examples and clear improvement suggestions."""

        if self.config.custom_instructions:
            prompt += f"\n\nAdditional Instructions:\n{self.config.custom_instructions}"
        
        return prompt
    
    def _build_user_prompt(self, context: ReviewContext) -> str:
        """Build user prompt with review context"""
        prompt_parts = [
            f"Review the following web page for SEO optimization:",
            f"",
            f"**Page Name:** {context.page_name}",
            f"",
        ]
        
        # Add project context if available
        if context.project_spec:
            prompt_parts.extend([
                f"**Project Specification:**",
                f"{context.project_spec}",
                f"",
            ])
        
        if context.target_audience:
            prompt_parts.extend([
                f"**Target Audience:**",
                f"{context.target_audience}",
                f"",
            ])
        
        # Add code
        prompt_parts.extend([
            f"**HTML Code:**",
            f"```html",
            f"{context.html}",
            f"```",
            f"",
        ])
        
        if context.css:
            prompt_parts.extend([
                f"**CSS Code:**",
                f"```css",
                f"{context.css[:2000]}...",  # Truncate if too long
                f"```",
                f"",
            ])
        
        prompt_parts.extend([
            f"Analyze this page and provide:",
            f"1. Overall SEO score (0-100)",
            f"2. Specific issues with severity levels",
            f"3. Strengths and what's working well",
            f"4. Top 3-5 priority improvements",
            f"5. Actionable recommendations with code examples",
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
                    "description": "Overall SEO score from 0-100"
                },
                "summary": {
                    "type": "string",
                    "description": "Brief summary of SEO analysis"
                },
                "strengths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of SEO strengths found in the page"
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
                                    "seo_metadata",
                                    "seo_structure",
                                    "seo_content",
                                    "seo_performance"
                                ],
                                "description": "Category of the SEO issue"
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
                                "description": "Detailed description of the issue"
                            },
                            "current_state": {
                                "type": "string",
                                "description": "Current state or what's wrong"
                            },
                            "suggested_improvement": {
                                "type": "string",
                                "description": "Specific suggestion for improvement with code example"
                            },
                            "impact": {
                                "type": "string",
                                "description": "Expected impact of implementing this improvement"
                            },
                            "code_reference": {
                                "type": "string",
                                "description": "Code snippet or reference to the issue location"
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
                        "has_title_tag": {"type": "boolean"},
                        "has_meta_description": {"type": "boolean"},
                        "has_h1": {"type": "boolean"},
                        "heading_count": {"type": "integer"},
                        "image_count": {"type": "integer"},
                        "images_with_alt": {"type": "integer"}
                    },
                    "required": ["has_title_tag", "has_meta_description", "has_h1", "heading_count", "image_count", "images_with_alt"],
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
