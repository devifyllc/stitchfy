"""
Anthropic Claude Generator

Implements UI generation using Anthropic's Claude models.
"""

from typing import Dict, Any
from anthropic import Anthropic
from .base_generator import BaseGenerator, GeneratorConfig, UIOutput
import json
import re


class ClaudeGenerator(BaseGenerator):
    """Anthropic Claude based UI generator"""
    
    SUPPORTED_MODELS = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-20240620',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
    ]
    
    def __init__(self, config: GeneratorConfig):
        """Initialize Claude generator with Anthropic client"""
        super().__init__(config)
        self.client = Anthropic(api_key=config.api_key)
        self.model = config.model or "claude-3-5-sonnet-20241022"
        
        if self.model not in self.SUPPORTED_MODELS:
            print(f"Warning: Model {self.model} not in supported list. Proceeding anyway.")
    
    def generate_ui(self, optimized_prompt: str, page_name: str) -> UIOutput:
        """
        Generate UI using Anthropic Claude
        
        Args:
            optimized_prompt: The optimized prompt for UI generation
            page_name: Name of the page being generated
            
        Returns:
            UIOutput containing HTML, CSS, JavaScript, and metadata
        """
        # Construct the system prompt for UI generation
        system_prompt = """You are an expert web developer specializing in creating modern, responsive, and accessible websites.

Your task is to generate complete, production-ready HTML, CSS, and JavaScript code based on the user's specifications.

IMPORTANT INSTRUCTIONS:
1. Generate COMPLETE, VALID code that can be used immediately
2. Use modern web standards (HTML5, CSS3, ES6+)
3. Ensure mobile-first responsive design
4. Follow accessibility best practices (WCAG AA compliance)
5. Use semantic HTML elements
6. Include proper meta tags and SEO elements
7. Create clean, well-commented code
8. Use modern CSS (Flexbox, Grid, custom properties)
9. Ensure cross-browser compatibility

OUTPUT FORMAT:
You must structure your response with clearly marked sections for HTML, CSS, and JavaScript.
Use the following format:

```html
[Complete HTML code including DOCTYPE, head, and body]
```

```css
[Complete CSS code with all styles]
```

```javascript
[Complete JavaScript code, or leave empty if not needed]
```

NOTES:
[Any important implementation notes or recommendations]

Make sure the HTML includes:
- Proper DOCTYPE and meta tags
- Responsive viewport meta tag
- Title and meta description
- Semantic HTML5 elements
- Accessibility attributes (ARIA labels, alt text, etc.)

Make sure the CSS includes:
- CSS reset or normalization
- Responsive design with media queries
- Modern layout techniques (Flexbox/Grid)
- Smooth transitions and animations where appropriate
- Custom CSS properties for theming

Make sure the JavaScript (if needed):
- Uses modern ES6+ syntax
- Includes proper event handling
- Has error handling
- Is well-commented
"""
        
        # Construct the user prompt
        user_prompt = f"""Generate a complete website page based on the following specifications:

PAGE NAME: {page_name}

SPECIFICATIONS:
{optimized_prompt}

Please generate complete, production-ready HTML, CSS, and JavaScript code following the output format specified."""
        
        try:
            # Call Anthropic API
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            # Extract the response content
            content = response.content[0].text
            
            # Extract code sections
            sections = self._extract_code_sections(content)
            html = sections.get('html', '')
            css = sections.get('css', '')
            javascript = sections.get('javascript', '')
            
            # Extract notes
            notes_match = re.search(r'NOTES?:?\s*\n(.*?)(?:\n```|$)', content, re.DOTALL | re.IGNORECASE)
            notes = notes_match.group(1).strip() if notes_match else ''
            
            # Build metadata
            metadata = {
                'model': self.model,
                'temperature': self.config.temperature,
                'input_tokens': response.usage.input_tokens,
                'output_tokens': response.usage.output_tokens,
                'stop_reason': response.stop_reason,
                'notes': notes,
            }
            
            # Create UIOutput
            return UIOutput(
                html=html,
                css=css,
                javascript=javascript,
                metadata=metadata,
                generator_name=self.get_name(),
                page_name=page_name
            )
            
        except Exception as e:
            raise RuntimeError(f"Failed to generate UI with Claude: {str(e)}")
    
    def supports_feature(self, feature: str) -> bool:
        """Check if generator supports specific features"""
        supported_features = {
            'streaming': True,
            'json_mode': False,
            'function_calling': True,
            'vision': True,
            'code_execution': False,
        }
        return supported_features.get(feature, False)
    
    def get_name(self) -> str:
        """Return generator name"""
        return f"Anthropic Claude ({self.model})"
    
    def validate_config(self) -> bool:
        """Validate generator configuration"""
        if not self.config.api_key:
            return False
        if not self.config.api_key.startswith('sk-ant-'):
            print("Warning: Anthropic API key should start with 'sk-ant-'")
        return True
    
    def get_cost_estimate(self, prompt_length: int) -> Dict[str, float]:
        """
        Estimate cost for generating UI
        
        Pricing as of 2024 (approximate):
        - Claude 3.5 Sonnet: $3/1M input tokens, $15/1M output tokens
        - Claude 3 Opus: $15/1M input tokens, $75/1M output tokens
        - Claude 3 Sonnet: $3/1M input tokens, $15/1M output tokens
        - Claude 3 Haiku: $0.25/1M input tokens, $1.25/1M output tokens
        """
        # Rough estimation: 4 characters ≈ 1 token
        estimated_input_tokens = prompt_length // 4 + 500  # +500 for system prompt
        estimated_output_tokens = self.config.max_tokens
        
        # Pricing per 1M tokens
        pricing = {
            'claude-3-5-sonnet-20241022': {'input': 3.0, 'output': 15.0},
            'claude-3-5-sonnet-20240620': {'input': 3.0, 'output': 15.0},
            'claude-3-opus-20240229': {'input': 15.0, 'output': 75.0},
            'claude-3-sonnet-20240229': {'input': 3.0, 'output': 15.0},
            'claude-3-haiku-20240307': {'input': 0.25, 'output': 1.25},
        }
        
        model_pricing = pricing.get(self.model, pricing['claude-3-5-sonnet-20241022'])
        
        input_cost = (estimated_input_tokens / 1_000_000) * model_pricing['input']
        output_cost = (estimated_output_tokens / 1_000_000) * model_pricing['output']
        total_cost = input_cost + output_cost
        
        return {
            'estimated_cost_usd': round(total_cost, 4),
            'estimated_input_tokens': estimated_input_tokens,
            'estimated_output_tokens': estimated_output_tokens,
            'input_cost_usd': round(input_cost, 4),
            'output_cost_usd': round(output_cost, 4),
            'model': self.model,
        }
