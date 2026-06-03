"""
OpenAI GPT-4 Generator

Implements UI generation using OpenAI's GPT-4 models.
"""

from typing import Dict, Any
from openai import OpenAI
from .base_generator import BaseGenerator, GeneratorConfig, UIOutput
import json


class GPTGenerator(BaseGenerator):
    """OpenAI GPT-4 based UI generator"""
    
    SUPPORTED_MODELS = [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
    ]
    
    def __init__(self, config: GeneratorConfig):
        """Initialize GPT generator with OpenAI client"""
        super().__init__(config)
        self.client = OpenAI(api_key=config.api_key)
        self.model = config.model or "gpt-4o"
        
        if self.model not in self.SUPPORTED_MODELS:
            print(f"Warning: Model {self.model} not in supported list. Proceeding anyway.")
    
    def generate_ui(self, optimized_prompt: str, page_name: str) -> UIOutput:
        """
        Generate UI using OpenAI GPT-4
        
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
Return your response in the following JSON structure:
{
  "html": "complete HTML code including DOCTYPE, head, and body",
  "css": "complete CSS code with all styles",
  "javascript": "complete JavaScript code (if needed, otherwise empty string)",
  "notes": "any important implementation notes or recommendations"
}

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
            # Call OpenAI API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                response_format={"type": "json_object"}
            )
            
            # Extract the response
            content = response.choices[0].message.content
            
            # Parse JSON response
            try:
                parsed_response = json.loads(content)
                html = parsed_response.get('html', '')
                css = parsed_response.get('css', '')
                javascript = parsed_response.get('javascript', '')
                notes = parsed_response.get('notes', '')
            except json.JSONDecodeError:
                # Fallback: try to extract code sections from non-JSON response
                sections = self._extract_code_sections(content)
                html = sections.get('html', '')
                css = sections.get('css', '')
                javascript = sections.get('javascript', '')
                notes = 'Response was not in expected JSON format, extracted code sections'
            
            # Build metadata
            metadata = {
                'model': self.model,
                'temperature': self.config.temperature,
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
                'total_tokens': response.usage.total_tokens,
                'finish_reason': response.choices[0].finish_reason,
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
            raise RuntimeError(f"Failed to generate UI with GPT: {str(e)}")
    
    def supports_feature(self, feature: str) -> bool:
        """Check if generator supports specific features"""
        supported_features = {
            'streaming': True,
            'json_mode': True,
            'function_calling': True,
            'vision': self.model in ['gpt-4o', 'gpt-4-turbo', 'gpt-4'],
            'code_execution': False,
        }
        return supported_features.get(feature, False)
    
    def get_name(self) -> str:
        """Return generator name"""
        return f"OpenAI GPT ({self.model})"
    
    def validate_config(self) -> bool:
        """Validate generator configuration"""
        if not self.config.api_key:
            return False
        if not self.config.api_key.startswith('sk-'):
            print("Warning: OpenAI API key should start with 'sk-'")
        return True
    
    def get_cost_estimate(self, prompt_length: int) -> Dict[str, float]:
        """
        Estimate cost for generating UI
        
        Pricing as of 2024 (approximate):
        - GPT-4o: $5/1M input tokens, $15/1M output tokens
        - GPT-4-turbo: $10/1M input tokens, $30/1M output tokens
        - GPT-3.5-turbo: $0.50/1M input tokens, $1.50/1M output tokens
        """
        # Rough estimation: 4 characters ≈ 1 token
        estimated_input_tokens = prompt_length // 4 + 500  # +500 for system prompt
        estimated_output_tokens = self.config.max_tokens
        
        # Pricing per 1M tokens
        pricing = {
            'gpt-4o': {'input': 5.0, 'output': 15.0},
            'gpt-4o-mini': {'input': 0.15, 'output': 0.60},
            'gpt-4-turbo': {'input': 10.0, 'output': 30.0},
            'gpt-4': {'input': 30.0, 'output': 60.0},
            'gpt-3.5-turbo': {'input': 0.50, 'output': 1.50},
        }
        
        model_pricing = pricing.get(self.model, pricing['gpt-4o'])
        
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
