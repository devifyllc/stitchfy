"""
Stitchfy Agent System

Multi-agent review and optimization system for AI-generated websites.
Agents provide specialized feedback on SEO, UX, Accessibility, and Marketing.
"""

from .base_agent import (
    BaseAgent,
    AgentConfig,
    AgentFeedback,
    FeedbackItem,
    FeedbackSeverity,
    FeedbackCategory,
    ReviewContext,
)
from .seo_agent import SEOAgent
from .ux_agent import UXAgent
from .accessibility_agent import AccessibilityAgent
from .marketing_agent import MarketingAgent
from .design_agent import DesignAgent
from .technical_agent import TechnicalAgent
from .orchestrator import ReviewOrchestrator, ReviewResult
from .refiner import Refiner, RefinementResult, RefinementIteration

__all__ = [
    # Base classes
    'BaseAgent',
    'AgentConfig',
    'AgentFeedback',
    'FeedbackItem',
    'FeedbackSeverity',
    'FeedbackCategory',
    'ReviewContext',
    # Agent implementations
    'SEOAgent',
    'UXAgent',
    'AccessibilityAgent',
    'MarketingAgent',
    'DesignAgent',
    'TechnicalAgent',
    # Orchestration
    'ReviewOrchestrator',
    'ReviewResult',
    # Refinement
    'Refiner',
    'RefinementResult',
    'RefinementIteration',
]
