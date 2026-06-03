"""
Google Gemini Generator

Implements UI generation using Google's Gemini models.
"""

from typing import Dict, Any
import google.generativeai as genai
from .base_generator import BaseGenerator, GeneratorConfig, UIOutput
import re


class GeminiGenerator(BaseGenerator):
    """Google Gemini based UI generator"""
    
    SUPPORTED_MODELS = [
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.0-pro',
    ]
    
    def __init__(self, config: GeneratorConfig):
        """Initialize Gemini generator with Google AI client"""
        super().__init__(config)
        genai.configure(api_key=config.api_key)
        self.model_name = config.model or "gemini-2.0-flash-exp"
        
        if self.model_name not in self.SUPPORTED_MODELS:
            print(f"Warning: Model {self.model_name} not in supported list. Proceeding anyway.")
        
        # Initialize the model
        self.model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config={
                'temperature': config.temperature,
                'max_output_tokens': config.max_tokens,
            }
        )
    
    def generate_ui(self, optimized_prompt: str, page_name: str) -> UIOutput:
        """
        Generate UI using Google Gemini
        
        Args:
            optimized_prompt: The optimized prompt for UI generation
            page_name: Name of the page being generated
            
        Returns:
            UIOutput containing HTML, CSS, JavaScript, and metadata
        """
        # Construct the comprehensive prompt
        full_prompt = f"""You are an expert web developer specializing in creating modern, responsive, and accessible websites.

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

---

PAGE NAME: {page_name}

SPECIFICATIONS:
{optimized_prompt}

Please generate complete, production-ready HTML, CSS, and JavaScript code following the output format specified above.

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
        
        try:
            # Generate content
            response = self.model.generate_content(full_prompt)
            
            # Extract the response text
            content = response.text
            
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
                'model': self.model_name,
                'temperature': self.config.temperature,
                'finish_reason': response.candidates[0].finish_reason.name if response.candidates else 'unknown',
                'safety_ratings': [
                    {
                        'category': rating.category.name,
                        'probability': rating.probability.name
                    }
                    for rating in response.candidates[0].safety_ratings
                ] if response.candidates else [],
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
            raise RuntimeError(f"Failed to generate UI with Gemini: {str(e)}")
    
    def supports_feature(self, feature: str) -> bool:
        """Check if generator supports specific features"""
        supported_features = {
            'streaming': True,
            'json_mode': True,
            'function_calling': True,
            'vision': True,
            'code_execution': True,
        }
        return supported_features.get(feature, False)
    
    def get_name(self) -> str:
        """Return generator name"""
        return f"Google Gemini ({self.model_name})"
    
    def validate_config(self) -> bool:
        """Validate generator configuration"""
        if not self.config.api_key:
            return False
        # Google API keys typically start with 'AIza'
        if not self.config.api_key.startswith('AIza'):
            print("Warning: Google API key typically starts with 'AIza'")
        return True
    
    def get_cost_estimate(self, prompt_length: int) -> Dict[str, float]:
        """
        Estimate cost for generating UI
        
        Pricing as of 2024 (approximate):
        - Gemini 2.0 Flash: Free tier available, then $0.075/1M input, $0.30/1M output
        - Gemini 1.5 Pro: $1.25/1M input tokens, $5.00/1M output tokens
        - Gemini 1.5 Flash: $0.075/1M input tokens, $0.30/1M output tokens
        """
        # Rough estimation: 4 characters ≈ 1 token
        estimated_input_tokens = prompt_length // 4 + 500  # +500 for system prompt
        estimated_output_tokens = self.config.max_tokens
        
        # Pricing per 1M tokens
        pricing = {
            'gemini-2.0-flash-exp': {'input': 0.0, 'output': 0.0},  # Experimental, free
            'gemini-1.5-pro': {'input': 1.25, 'output': 5.00},
            'gemini-1.5-flash': {'input': 0.075, 'output': 0.30},
            'gemini-1.0-pro': {'input': 0.50, 'output': 1.50},
        }
        
        model_pricing = pricing.get(self.model_name, pricing['gemini-1.5-flash'])
        
        input_cost = (estimated_input_tokens / 1_000_000) * model_pricing['input']
        output_cost = (estimated_output_tokens / 1_000_000) * model_pricing['output']
        total_cost = input_cost + output_cost
        
        return {
            'estimated_cost_usd': round(total_cost, 4),
            'estimated_input_tokens': estimated_input_tokens,
            'estimated_output_tokens': estimated_output_tokens,
            'input_cost_usd': round(input_cost, 4),
            'output_cost_usd': round(output_cost, 4),
            'model': self.model_name,
        }
