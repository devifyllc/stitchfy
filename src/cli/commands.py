"""
Stitchfy CLI Commands

Command-line interface implementation using Click.
"""

import click
import sys
from pathlib import Path
from typing import Optional
import json

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.core.config_loader import ConfigLoader
from src.generators.factory import GeneratorFactory
from src.generators.base_generator import GeneratorConfig


@click.group()
@click.version_option(version='1.0.0')
def cli():
    """
    Stitchfy - AI-Powered Website Generation Framework
    
    Transform business specifications into polished websites using
    multiple AI providers (GPT, Claude, Gemini, etc.)
    """
    pass


@cli.command()
@click.option(
    '--generator',
    '-g',
    type=str,
    help='Generator to use (gpt, claude, gemini). Overrides config default.'
)
@click.option(
    '--page',
    '-p',
    type=str,
    default='home',
    help='Page name to generate (default: home)'
)
@click.option(
    '--prompt',
    type=click.Path(exists=True),
    help='Path to prompt file. If not specified, reads from pages/{page}.md'
)
@click.option(
    '--output',
    '-o',
    type=click.Path(),
    help='Output directory. Overrides config setting.'
)
@click.option(
    '--config',
    '-c',
    type=click.Path(exists=True),
    help='Path to configuration file'
)
@click.option(
    '--with-fallback',
    is_flag=True,
    help='Enable fallback to alternative generators on failure'
)
@click.option(
    '--show-cost',
    is_flag=True,
    help='Show cost estimate before generating'
)
def generate(
    generator: Optional[str],
    page: str,
    prompt: Optional[str],
    output: Optional[str],
    config: Optional[str],
    with_fallback: bool,
    show_cost: bool
):
    """
    Generate website UI from specifications
    
    Examples:
    
      # Generate using default generator (from config)
      stitchfy generate
      
      # Generate using specific generator
      stitchfy generate --generator gpt
      
      # Generate specific page
      stitchfy generate --page about --generator claude
      
      # Generate with fallback enabled
      stitchfy generate --with-fallback
    """
    try:
        # Load configuration
        click.echo("Loading configuration...")
        app_config = ConfigLoader.load(config)
        
        # Determine which generator to use
        generator_name = generator or app_config.default_generator
        click.echo(f"Using generator: {generator_name}")
        
        # Get generator configuration
        gen_config_dict = app_config.get_generator_config(generator_name)
        if not gen_config_dict:
            click.echo(f"Error: No configuration found for generator '{generator_name}'", err=True)
            sys.exit(1)
        
        # Validate generator config
        if not ConfigLoader.validate_generator_config(gen_config_dict):
            click.echo(
                f"Error: Invalid configuration for generator '{generator_name}'. "
                f"Make sure API key is set in environment variables.",
                err=True
            )
            sys.exit(1)
        
        # Load prompt
        if prompt:
            prompt_path = Path(prompt)
        else:
            prompt_path = Path('pages') / f'{page}.md'
        
        if not prompt_path.exists():
            click.echo(f"Error: Prompt file not found: {prompt_path}", err=True)
            sys.exit(1)
        
        click.echo(f"Reading prompt from: {prompt_path}")
        optimized_prompt = prompt_path.read_text(encoding='utf-8')
        
        # Show cost estimate if requested
        if show_cost:
            gen_config = GeneratorConfig(**gen_config_dict)
            temp_generator = GeneratorFactory.create_generator(generator_name, gen_config)
            cost_estimate = temp_generator.get_cost_estimate(len(optimized_prompt))
            
            click.echo("\n" + "="*50)
            click.echo("COST ESTIMATE")
            click.echo("="*50)
            click.echo(f"Generator: {temp_generator.get_name()}")
            click.echo(f"Estimated cost: ${cost_estimate['estimated_cost_usd']:.4f} USD")
            click.echo(f"Input tokens: ~{cost_estimate['estimated_input_tokens']}")
            click.echo(f"Output tokens: ~{cost_estimate['estimated_output_tokens']}")
            click.echo("="*50 + "\n")
            
            if not click.confirm("Continue with generation?"):
                click.echo("Generation cancelled.")
                return
        
        # Create generator
        click.echo("Initializing generator...")
        
        if with_fallback and app_config.fallback_enabled:
            # Create generator with fallback
            configs = {}
            for gen_name in [generator_name] + app_config.fallback_generators:
                gen_cfg = app_config.get_generator_config(gen_name)
                if gen_cfg and ConfigLoader.validate_generator_config(gen_cfg):
                    configs[gen_name] = GeneratorConfig(**gen_cfg)
            
            gen = GeneratorFactory.create_with_fallback(
                generator_name,
                app_config.fallback_generators,
                configs
            )
        else:
            # Create single generator
            gen_config = GeneratorConfig(**gen_config_dict)
            gen = GeneratorFactory.create_generator(generator_name, gen_config)
        
        # Generate UI
        click.echo(f"\nGenerating UI for page: {page}")
        click.echo("This may take a moment...\n")
        
        ui_output = gen.generate_ui(optimized_prompt, page)
        
        # Determine output directory
        output_dir = output or app_config.get_output_dir()
        output_path = Path(output_dir)
        
        # Save files
        click.echo(f"Saving output to: {output_path}")
        saved_files = ui_output.save_to_files(str(output_path))
        
        # Display results
        click.echo("\n" + "="*50)
        click.echo("GENERATION COMPLETE")
        click.echo("="*50)
        click.echo(f"Generator: {ui_output.generator_name}")
        click.echo(f"Page: {ui_output.page_name}")
        click.echo(f"\nGenerated files:")
        for file_type, file_path in saved_files.items():
            click.echo(f"  - {file_type}: {file_path}")
        
        # Show metadata
        if ui_output.metadata:
            click.echo(f"\nMetadata:")
            for key, value in ui_output.metadata.items():
                if key not in ['notes']:
                    click.echo(f"  - {key}: {value}")
        
        click.echo("="*50)
        click.echo("\n✓ Generation successful!")
        
    except Exception as e:
        click.echo(f"\nError: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.option(
    '--config',
    '-c',
    type=click.Path(exists=True),
    help='Path to configuration file'
)
def list_generators(config: Optional[str]):
    """
    List available generators and their configurations
    """
    try:
        # Load configuration
        app_config = ConfigLoader.load(config)
        
        click.echo("\n" + "="*50)
        click.echo("AVAILABLE GENERATORS")
        click.echo("="*50)
        
        for gen_name in GeneratorFactory.list_available_generators():
            info = GeneratorFactory.get_generator_info(gen_name)
            gen_config = app_config.get_generator_config(gen_name)
            
            click.echo(f"\n{gen_name.upper()}")
            click.echo(f"  Class: {info['class']}")
            click.echo(f"  Default model: {info['default_model']}")
            click.echo(f"  Aliases: {', '.join(info['aliases'])}")
            
            if gen_config:
                is_valid = ConfigLoader.validate_generator_config(gen_config)
                status = "✓ Configured" if is_valid else "✗ Not configured (missing API key)"
                click.echo(f"  Status: {status}")
                if is_valid:
                    click.echo(f"  Model: {gen_config.get('model', 'default')}")
            else:
                click.echo(f"  Status: ✗ No configuration")
        
        click.echo("\n" + "="*50)
        click.echo(f"\nDefault generator: {app_config.default_generator}")
        
        if app_config.fallback_enabled:
            click.echo(f"Fallback enabled: {', '.join(app_config.fallback_generators)}")
        
    except Exception as e:
        click.echo(f"\nError: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('generator', type=str)
@click.option(
    '--config',
    '-c',
    type=click.Path(exists=True),
    help='Path to configuration file'
)
def info(generator: str, config: Optional[str]):
    """
    Show detailed information about a specific generator
    
    Example:
      stitchfy info gpt
    """
    try:
        # Load configuration
        app_config = ConfigLoader.load(config)
        
        # Get generator info
        info = GeneratorFactory.get_generator_info(generator)
        gen_config = app_config.get_generator_config(generator)
        
        click.echo("\n" + "="*50)
        click.echo(f"GENERATOR INFO: {generator.upper()}")
        click.echo("="*50)
        
        click.echo(f"\nClass: {info['class']}")
        click.echo(f"Default model: {info['default_model']}")
        click.echo(f"Aliases: {', '.join(info['aliases'])}")
        
        click.echo(f"\nSupported models:")
        for model in info['supported_models']:
            click.echo(f"  - {model}")
        
        if gen_config:
            is_valid = ConfigLoader.validate_generator_config(gen_config)
            click.echo(f"\nConfiguration status: {'✓ Valid' if is_valid else '✗ Invalid'}")
            
            if is_valid:
                click.echo(f"\nCurrent settings:")
                click.echo(f"  Model: {gen_config.get('model', 'default')}")
                click.echo(f"  Temperature: {gen_config.get('temperature', 0.7)}")
                click.echo(f"  Max tokens: {gen_config.get('max_tokens', 8000)}")
        else:
            click.echo(f"\nConfiguration status: ✗ Not configured")
        
        click.echo("="*50 + "\n")
        
    except Exception as e:
        click.echo(f"\nError: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('project_name', type=str)
@click.option(
    '--template',
    '-t',
    type=str,
    default='default',
    help='Project template to use (default: default)'
)
def init(project_name: str, template: str):
    """
    Initialize a new Stitchfy project
    
    Example:
      stitchfy init my-website
    """
    try:
        project_path = Path(project_name)
        
        if project_path.exists():
            click.echo(f"Error: Directory '{project_name}' already exists", err=True)
            sys.exit(1)
        
        click.echo(f"Creating new Stitchfy project: {project_name}")
        
        # Create directory structure
        directories = [
            project_path,
            project_path / 'pages',
            project_path / 'agents',
            project_path / 'output' / 'stitch-prompts',
            project_path / 'output' / 'reviews',
            project_path / 'output' / 'final',
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            click.echo(f"  Created: {directory}")
        
        # Copy template files (for now, create basic files)
        # In a full implementation, these would come from templates
        
        click.echo(f"\n✓ Project '{project_name}' created successfully!")
        click.echo(f"\nNext steps:")
        click.echo(f"  1. cd {project_name}")
        click.echo(f"  2. Copy stitchfy.config.yaml to your project")
        click.echo(f"  3. Set up your API keys in environment variables")
        click.echo(f"  4. Edit pages/*.md files with your specifications")
        click.echo(f"  5. Run: stitchfy generate")
        
    except Exception as e:
        click.echo(f"\nError: {str(e)}", err=True)
        sys.exit(1)


if __name__ == '__main__':
    cli()
