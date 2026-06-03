"""
Base Generator Abstract Class

Defines the interface that all UI generators must implement.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class GeneratorConfig:
    """Configuration for a generator"""
    api_key: str
    model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 8000
    additional_params: Optional[Dict[str, Any]] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate configuration after initialization"""
        if not self.api_key:
            raise ValueError("API key is required")
        if self.temperature < 0 or self.temperature > 2:
            raise ValueError("Temperature must be between 0 and 2")
        if self.max_tokens < 100:
            raise ValueError("Max tokens must be at least 100")


@dataclass
class UIOutput:
    """Standardized output from any generator"""
    html: str
    css: str
    javascript: str
    metadata: Dict[str, Any]
    generator_name: str
    page_name: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'html': self.html,
            'css': self.css,
            'javascript': self.javascript,
            'metadata': self.metadata,
            'generator_name': self.generator_name,
            'page_name': self.page_name,
            'timestamp': self.timestamp,
        }
    
    def save_to_files(self, output_dir: str) -> Dict[str, str]:
        """Save output to separate files"""
        import os
        from pathlib import Path
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        files = {}
        
        # Save HTML
        html_file = output_path / f"{self.page_name}.html"
        html_file.write_text(self.html, encoding='utf-8')
        files['html'] = str(html_file)
        
        # Save CSS
        css_file = output_path / f"{self.page_name}.css"
        css_file.write_text(self.css, encoding='utf-8')
        files['css'] = str(css_file)
        
        # Save JavaScript
        js_file = output_path / f"{self.page_name}.js"
        js_file.write_text(self.javascript, encoding='utf-8')
        files['js'] = str(js_file)
        
        # Save metadata
        import json
        metadata_file = output_path / f"{self.page_name}.metadata.json"
        metadata_file.write_text(
            json.dumps(self.to_dict(), indent=2),
            encoding='utf-8'
        )
        files['metadata'] = str(metadata_file)
        
        return files


class BaseGenerator(ABC):
    """Abstract base class for all UI generators"""
    
    def __init__(self, config: GeneratorConfig):
        """
        Initialize the generator with configuration
        
        Args:
            config: Generator configuration
        """
        self.config = config
        if not self.validate_config():
            raise ValueError(f"Invalid configuration for {self.get_name()}")
    
    @abstractmethod
    def generate_ui(self, optimized_prompt: str, page_name: str) -> UIOutput:
        """
        Generate UI from optimized prompt
        
        Args:
            optimized_prompt: The optimized prompt for UI generation
            page_name: Name of the page being generated
            
        Returns:
            UIOutput containing HTML, CSS, JavaScript, and metadata
        """
        pass
    
    @abstractmethod
    def supports_feature(self, feature: str) -> bool:
        """
        Check if generator supports specific features
        
        Args:
            feature: Feature name (e.g., 'streaming', 'vision', 'code_execution')
            
        Returns:
            True if feature is supported, False otherwise
        """
        pass
    
    @abstractmethod
    def get_name(self) -> str:
        """
        Return generator name
        
        Returns:
            Human-readable generator name
        """
        pass
    
    @abstractmethod
    def validate_config(self) -> bool:
        """
        Validate generator configuration
        
        Returns:
            True if configuration is valid, False otherwise
        """
        pass
    
    def get_cost_estimate(self, prompt_length: int) -> Dict[str, float]:
        """
        Estimate cost for generating UI (optional, can be overridden)
        
        Args:
            prompt_length: Length of the prompt in characters
            
        Returns:
            Dictionary with cost estimates
        """
        return {
            'estimated_cost_usd': 0.0,
            'note': 'Cost estimation not implemented for this generator'
        }
    
    def get_capabilities(self) -> Dict[str, Any]:
        """
        Get generator capabilities and limitations
        
        Returns:
            Dictionary describing capabilities
        """
        return {
            'name': self.get_name(),
            'model': self.config.model,
            'max_tokens': self.config.max_tokens,
            'supports_streaming': self.supports_feature('streaming'),
            'supports_vision': self.supports_feature('vision'),
        }
    
    def _extract_code_sections(self, response: str) -> Dict[str, str]:
        """
        Helper method to extract HTML, CSS, and JavaScript from AI response
        
        Args:
            response: Raw response from AI model
            
        Returns:
            Dictionary with extracted code sections
        """
        import re
        
        sections = {
            'html': '',
            'css': '',
            'javascript': ''
        }
        
        # Try to extract code blocks
        html_match = re.search(r'```html\n(.*?)```', response, re.DOTALL | re.IGNORECASE)
        css_match = re.search(r'```css\n(.*?)```', response, re.DOTALL | re.IGNORECASE)
        js_match = re.search(r'```(?:javascript|js)\n(.*?)```', response, re.DOTALL | re.IGNORECASE)
        
        if html_match:
            sections['html'] = html_match.group(1).strip()
        if css_match:
            sections['css'] = css_match.group(1).strip()
        if js_match:
            sections['javascript'] = js_match.group(1).strip()
        
        # If no code blocks found, try to extract from the entire response
        if not sections['html']:
            # Look for HTML-like content
            html_pattern = r'<!DOCTYPE html>.*?</html>'
            html_full_match = re.search(html_pattern, response, re.DOTALL | re.IGNORECASE)
            if html_full_match:
                sections['html'] = html_full_match.group(0).strip()
        
        return sections
