"""
Technical/QA Agent

Validates technical correctness, file references, HTML validity, and resource loading.
Focuses on catching bugs and technical issues that affect functionality.
"""

from typing import Dict, Any
from .base_agent import BaseAgent, AgentFeedback, FeedbackCategory


class TechnicalAgent(BaseAgent):
    """
    Agent specialized in technical validation and quality assurance.
    
    Analyzes:
    - File references (CSS, JS, images)
    - HTML validation and structure
    - Broken links and resources
    - JavaScript errors and console warnings
    - Resource loading and performance
    - Cross-browser compatibility
    - Technical best practices
    """
    
    def get_name(self) -> str:
        return "Technical Agent"
    
    def get_version(self) -> str:
        return "1.0.0"
    
    def get_description(self) -> str:
        return "Validates technical correctness, file references, and resource loading"
    
    def get_focus_areas(self) -> list[str]:
        return [
            "File reference validation (CSS, JS, images)",
            "HTML validation and W3C compliance",
            "Broken link detection",
            "Resource loading verification",
            "JavaScript syntax and execution",
            "Console errors and warnings",
            "Cross-browser compatibility",
            "Performance and optimization",
        ]
    
    def _build_system_prompt(self) -> str:
        return """You are an expert QA engineer and technical validator analyzing web pages for technical correctness and functionality.

Your role is to identify technical bugs and issues that would prevent the page from working correctly.

1. FILE REFERENCES
   - CSS file references (href attributes)
   - JavaScript file references (src attributes)
   - Image file references (src, srcset)
   - Font file references
   - Favicon and manifest references
   - Ensure file names match actual files

2. HTML VALIDATION
   - Valid HTML5 structure
   - Proper DOCTYPE declaration
   - Correct tag nesting
   - Required attributes present
   - No deprecated tags or attributes
   - Proper character encoding

3. RESOURCE LOADING
   - All referenced files exist
   - Correct file paths (relative vs absolute)
   - No broken links
   - Proper resource ordering
   - Async/defer attributes used correctly

4. JAVASCRIPT VALIDATION
   - Syntax errors
   - Undefined variables or functions
   - Event handler references
   - DOM manipulation correctness
   - Script execution order

5. LINKS & NAVIGATION
   - Internal links validity
   - Anchor tag href attributes
   - Navigation menu functionality
   - Form action attributes
   - Button onclick handlers

6. TECHNICAL BEST PRACTICES
   - Proper use of meta tags
   - Viewport configuration
   - Character set declaration
   - Language attribute
   - Title tag presence

7. PERFORMANCE ISSUES
   - Blocking resources
   - Large file references
   - Inefficient code patterns
   - Missing optimization attributes

8. CROSS-BROWSER COMPATIBILITY
   - Modern CSS/JS features
   - Vendor prefixes if needed
   - Fallbacks for older browsers
   - Progressive enhancement

Focus on issues that would cause the page to break or not function correctly.
Provide specific fixes with corrected code examples."""
    
    def _build_user_prompt(self, context) -> str:
        # Extract file references from HTML
        import re
        
        css_refs = re.findall(r'href=["\']([^"\']*\.css)["\']', context.html)
        js_refs = re.findall(r'src=["\']([^"\']*\.js)["\']', context.html)
        img_refs = re.findall(r'src=["\']([^"\']*\.(jpg|jpeg|png|gif|svg|webp))["\']', context.html)
        
        return f"""Analyze this web page for technical correctness and identify any bugs or issues.

Page Name: {context.page_name}

HTML:
{context.html[:4000]}

CSS:
{context.css[:2000]}

JavaScript:
{context.javascript[:1500]}

DETECTED FILE REFERENCES:
CSS files referenced: {css_refs if css_refs else 'None'}
JS files referenced: {js_refs if js_refs else 'None'}
Image files referenced: {len(img_refs)} images

Expected file names based on page name:
- CSS: {context.page_name}.css
- JS: {context.page_name}.js

VALIDATION CHECKLIST:
1. Do CSS/JS file references match the expected file names?
2. Are all href and src attributes correct?
3. Is the HTML structure valid?
4. Are there any syntax errors in JavaScript?
5. Do all links and navigation work?
6. Are required meta tags present?
7. Would this page load and function correctly?

Identify ALL technical issues that would prevent proper functionality.
Provide specific fixes with corrected code."""
    
    def _get_structured_output_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "overall_score": {
                    "type": "number",
                    "description": "Overall technical quality score from 0-100"
                },
                "summary": {
                    "type": "string",
                    "description": "Brief summary of technical quality"
                },
                "strengths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Technical strengths and correct implementations"
                },
                "priorities": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Top 3-5 technical issues to fix"
                },
                "feedback_items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "enum": [
                                    "technical_file_refs",
                                    "technical_html_validation",
                                    "technical_links",
                                    "technical_javascript",
                                    "technical_resources",
                                    "technical_performance",
                                    "technical_compatibility",
                                    "technical_best_practices"
                                ],
                                "description": "Technical category"
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
                                "description": "Current incorrect state"
                            },
                            "suggested_improvement": {
                                "type": "string",
                                "description": "Specific fix with corrected code"
                            },
                            "impact": {
                                "type": "string",
                                "description": "Impact if not fixed"
                            },
                            "code_reference": {
                                "type": "string",
                                "description": "Code snippet showing the fix"
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
                        "has_valid_doctype": {"type": "boolean"},
                        "has_charset": {"type": "boolean"},
                        "has_viewport": {"type": "boolean"},
                        "broken_file_refs": {"type": "integer"},
                        "javascript_errors": {"type": "integer"},
                        "html_validation_errors": {"type": "integer"}
                    },
                    "required": ["has_valid_doctype", "has_charset", "has_viewport", "broken_file_refs", "javascript_errors", "html_validation_errors"],
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
            "technical_file_refs": FeedbackCategory.TECHNICAL_FILE_REFS,
            "technical_html_validation": FeedbackCategory.TECHNICAL_HTML_VALIDATION,
            "technical_links": FeedbackCategory.TECHNICAL_LINKS,
            "technical_javascript": FeedbackCategory.TECHNICAL_JAVASCRIPT,
            "technical_resources": FeedbackCategory.TECHNICAL_RESOURCES,
            "technical_performance": FeedbackCategory.TECHNICAL_PERFORMANCE,
            "technical_compatibility": FeedbackCategory.TECHNICAL_COMPATIBILITY,
            "technical_best_practices": FeedbackCategory.TECHNICAL_BEST_PRACTICES,
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
                category=category_map.get(item["category"], FeedbackCategory.TECHNICAL_FILE_REFS),
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
