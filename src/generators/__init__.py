"""
Stitchfy Multi-Strategy Generator System

This package provides a pluggable architecture for generating UI code
using different AI providers (OpenAI GPT, Anthropic Claude, Google Gemini, etc.)
"""

from .base_generator import BaseGenerator, GeneratorConfig, UIOutput
from .factory import GeneratorFactory

__all__ = [
    'BaseGenerator',
    'GeneratorConfig',
    'UIOutput',
    'GeneratorFactory',
]
