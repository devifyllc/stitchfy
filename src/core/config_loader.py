"""
Configuration Loader

Loads and parses Stitchfy configuration files with environment variable substitution.
"""

import os
import re
import yaml
from typing import Dict, Any, Optional
from pathlib import Path
from dataclasses import dataclass, field
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


@dataclass
class StitchfyConfig:
    """Stitchfy configuration"""
    default_generator: str
    generators: Dict[str, Dict[str, Any]]
    fallback_enabled: bool = False
    fallback_generators: list = field(default_factory=list)
    output: Dict[str, Any] = field(default_factory=dict)
    logging: Dict[str, Any] = field(default_factory=dict)
    cost_tracking: Dict[str, Any] = field(default_factory=dict)
    
    def get_generator_config(self, generator_name: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a specific generator"""
        return self.generators.get(generator_name)
    
    def get_output_dir(self) -> str:
        """Get output directory path"""
        return self.output.get('output_dir', 'output/final')
    
    def get_log_level(self) -> str:
        """Get logging level"""
        return self.logging.get('level', 'INFO')


class ConfigLoader:
    """Loads and processes Stitchfy configuration files"""
    
    DEFAULT_CONFIG_PATHS = [
        'stitchfy.config.yaml',
        'stitchfy.config.yml',
        '.stitchfy.yaml',
        '.stitchfy.yml',
    ]
    
    @classmethod
    def load(cls, config_path: Optional[str] = None) -> StitchfyConfig:
        """
        Load configuration from file
        
        Args:
            config_path: Path to configuration file. If None, searches for default config files.
            
        Returns:
            StitchfyConfig object
            
        Raises:
            FileNotFoundError: If config file not found
            ValueError: If config file is invalid
        """
        # Find config file
        if config_path:
            config_file = Path(config_path)
            if not config_file.exists():
                raise FileNotFoundError(f"Configuration file not found: {config_path}")
        else:
            config_file = cls._find_config_file()
            if not config_file:
                raise FileNotFoundError(
                    f"No configuration file found. Searched for: {', '.join(cls.DEFAULT_CONFIG_PATHS)}"
                )
        
        # Load YAML
        with open(config_file, 'r', encoding='utf-8') as f:
            raw_config = yaml.safe_load(f)
        
        if not raw_config:
            raise ValueError(f"Configuration file is empty: {config_file}")
        
        # Substitute environment variables
        processed_config = cls._substitute_env_vars(raw_config)
        
        # Validate and create config object
        return cls._create_config(processed_config)
    
    @classmethod
    def _find_config_file(cls) -> Optional[Path]:
        """Find configuration file in default locations"""
        for config_name in cls.DEFAULT_CONFIG_PATHS:
            config_path = Path(config_name)
            if config_path.exists():
                return config_path
        return None
    
    @classmethod
    def _substitute_env_vars(cls, config: Any) -> Any:
        """
        Recursively substitute environment variables in configuration
        
        Supports ${VAR_NAME} and ${VAR_NAME:-default_value} syntax
        
        Args:
            config: Configuration object (dict, list, or string)
            
        Returns:
            Configuration with environment variables substituted
        """
        if isinstance(config, dict):
            return {k: cls._substitute_env_vars(v) for k, v in config.items()}
        elif isinstance(config, list):
            return [cls._substitute_env_vars(item) for item in config]
        elif isinstance(config, str):
            return cls._substitute_env_var_string(config)
        else:
            return config
    
    @classmethod
    def _substitute_env_var_string(cls, value: str) -> str:
        """
        Substitute environment variables in a string
        
        Supports:
        - ${VAR_NAME} - required variable
        - ${VAR_NAME:-default} - optional variable with default
        
        Args:
            value: String potentially containing environment variable references
            
        Returns:
            String with variables substituted
        """
        # Pattern for ${VAR_NAME:-default_value}
        pattern_with_default = r'\$\{([A-Za-z_][A-Za-z0-9_]*):-(.*?)\}'
        # Pattern for ${VAR_NAME}
        pattern_simple = r'\$\{([A-Za-z_][A-Za-z0-9_]*)\}'
        
        # First, handle variables with defaults
        def replace_with_default(match):
            var_name = match.group(1)
            default_value = match.group(2)
            return os.environ.get(var_name, default_value)
        
        value = re.sub(pattern_with_default, replace_with_default, value)
        
        # Then, handle simple variables
        def replace_simple(match):
            var_name = match.group(1)
            env_value = os.environ.get(var_name)
            if env_value is None:
                # Keep the placeholder if variable not found
                return match.group(0)
            return env_value
        
        value = re.sub(pattern_simple, replace_simple, value)
        
        return value
    
    @classmethod
    def _create_config(cls, config_dict: Dict[str, Any]) -> StitchfyConfig:
        """
        Create StitchfyConfig object from dictionary
        
        Args:
            config_dict: Configuration dictionary
            
        Returns:
            StitchfyConfig object
            
        Raises:
            ValueError: If required fields are missing
        """
        # Validate required fields
        if 'default_generator' not in config_dict:
            raise ValueError("Configuration must specify 'default_generator'")
        
        if 'generators' not in config_dict or not config_dict['generators']:
            raise ValueError("Configuration must specify at least one generator")
        
        # Create config object
        return StitchfyConfig(
            default_generator=config_dict['default_generator'],
            generators=config_dict['generators'],
            fallback_enabled=config_dict.get('fallback_enabled', False),
            fallback_generators=config_dict.get('fallback_generators', []),
            output=config_dict.get('output', {}),
            logging=config_dict.get('logging', {}),
            cost_tracking=config_dict.get('cost_tracking', {}),
        )
    
    @classmethod
    def validate_generator_config(cls, generator_config: Dict[str, Any]) -> bool:
        """
        Validate a generator configuration
        
        Args:
            generator_config: Generator configuration dictionary
            
        Returns:
            True if valid, False otherwise
        """
        # Check for required fields
        if 'api_key' not in generator_config:
            return False
        
        # Check if API key is still a placeholder
        api_key = generator_config['api_key']
        if api_key.startswith('${') and api_key.endswith('}'):
            return False
        
        return True
