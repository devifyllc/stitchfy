"""
Generator Factory

Provides a factory pattern for creating and managing different UI generators.
"""

from typing import Dict, Type, List, Optional
from .base_generator import BaseGenerator, GeneratorConfig
from .gpt_generator import GPTGenerator
from .claude_generator import ClaudeGenerator
from .gemini_generator import GeminiGenerator


class GeneratorFactory:
    """Factory for creating and managing generators"""
    
    # Registry of available generators
    _generators: Dict[str, Type[BaseGenerator]] = {
        'gpt': GPTGenerator,
        'gpt4': GPTGenerator,
        'gpt-4': GPTGenerator,
        'openai': GPTGenerator,
        'claude': ClaudeGenerator,
        'anthropic': ClaudeGenerator,
        'gemini': GeminiGenerator,
        'google': GeminiGenerator,
    }
    
    # Default models for each generator type
    _default_models = {
        'gpt': 'gpt-4o',
        'claude': 'claude-3-5-sonnet-20241022',
        'gemini': 'gemini-2.0-flash-exp',
    }
    
    @classmethod
    def create_generator(
        cls,
        generator_type: str,
        config: GeneratorConfig
    ) -> BaseGenerator:
        """
        Create a generator instance
        
        Args:
            generator_type: Type of generator (e.g., 'gpt', 'claude', 'gemini')
            config: Generator configuration
            
        Returns:
            Initialized generator instance
            
        Raises:
            ValueError: If generator type is unknown
        """
        generator_type_lower = generator_type.lower()
        
        if generator_type_lower not in cls._generators:
            available = ', '.join(sorted(set(cls._generators.keys())))
            raise ValueError(
                f"Unknown generator type: '{generator_type}'. "
                f"Available generators: {available}"
            )
        
        generator_class = cls._generators[generator_type_lower]
        
        # Set default model if not specified
        if not config.model:
            # Map to canonical name for default lookup
            canonical_name = cls._get_canonical_name(generator_type_lower)
            config.model = cls._default_models.get(canonical_name)
        
        return generator_class(config)
    
    @classmethod
    def list_available_generators(cls) -> List[str]:
        """
        List all available generator types
        
        Returns:
            List of unique generator type names
        """
        # Return unique canonical names
        return ['gpt', 'claude', 'gemini']
    
    @classmethod
    def get_generator_info(cls, generator_type: str) -> Dict[str, any]:
        """
        Get information about a specific generator
        
        Args:
            generator_type: Type of generator
            
        Returns:
            Dictionary with generator information
        """
        generator_type_lower = generator_type.lower()
        
        if generator_type_lower not in cls._generators:
            raise ValueError(f"Unknown generator type: '{generator_type}'")
        
        generator_class = cls._generators[generator_type_lower]
        canonical_name = cls._get_canonical_name(generator_type_lower)
        
        info = {
            'name': canonical_name,
            'class': generator_class.__name__,
            'default_model': cls._default_models.get(canonical_name),
            'supported_models': getattr(generator_class, 'SUPPORTED_MODELS', []),
            'aliases': [k for k, v in cls._generators.items() if v == generator_class],
        }
        
        return info
    
    @classmethod
    def register_generator(
        cls,
        name: str,
        generator_class: Type[BaseGenerator],
        default_model: Optional[str] = None
    ) -> None:
        """
        Register a custom generator
        
        Args:
            name: Name to register the generator under
            generator_class: Generator class (must inherit from BaseGenerator)
            default_model: Default model for this generator
        """
        if not issubclass(generator_class, BaseGenerator):
            raise ValueError(
                f"Generator class must inherit from BaseGenerator, "
                f"got {generator_class.__name__}"
            )
        
        name_lower = name.lower()
        cls._generators[name_lower] = generator_class
        
        if default_model:
            cls._default_models[name_lower] = default_model
    
    @classmethod
    def _get_canonical_name(cls, generator_type: str) -> str:
        """
        Get canonical name for a generator type
        
        Args:
            generator_type: Generator type (may be an alias)
            
        Returns:
            Canonical name
        """
        # Map aliases to canonical names
        canonical_map = {
            'gpt': 'gpt',
            'gpt4': 'gpt',
            'gpt-4': 'gpt',
            'openai': 'gpt',
            'claude': 'claude',
            'anthropic': 'claude',
            'gemini': 'gemini',
            'google': 'gemini',
        }
        
        return canonical_map.get(generator_type.lower(), generator_type.lower())
    
    @classmethod
    def create_with_fallback(
        cls,
        primary_type: str,
        fallback_types: List[str],
        configs: Dict[str, GeneratorConfig]
    ) -> BaseGenerator:
        """
        Create a generator with fallback options
        
        Args:
            primary_type: Primary generator type to try
            fallback_types: List of fallback generator types
            configs: Dictionary mapping generator types to their configs
            
        Returns:
            First successfully created generator
            
        Raises:
            RuntimeError: If no generator could be created
        """
        all_types = [primary_type] + fallback_types
        errors = []
        
        for gen_type in all_types:
            try:
                if gen_type not in configs:
                    errors.append(f"{gen_type}: No configuration provided")
                    continue
                
                generator = cls.create_generator(gen_type, configs[gen_type])
                print(f"Successfully created generator: {generator.get_name()}")
                return generator
                
            except Exception as e:
                errors.append(f"{gen_type}: {str(e)}")
                continue
        
        # If we get here, all generators failed
        error_msg = "Failed to create any generator. Errors:\n" + "\n".join(
            f"  - {err}" for err in errors
        )
        raise RuntimeError(error_msg)
