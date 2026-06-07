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
from src.agents import (
    SEOAgent, UXAgent, AccessibilityAgent, MarketingAgent, DesignAgent, TechnicalAgent,
    ReviewOrchestrator, ReviewContext, AgentConfig,
    Refiner, RefinementResult
)


@click.group()
@click.version_option(version='2.0.0')
def cli():
    """
    Stitchfy - AI-Powered Website Generation Framework
    
    Transform business specifications into polished websites using
    multiple AI providers (GPT, Claude, Gemini) and automated review agents.
    
    Commands:
      generate        Generate website UI from specifications
      review          Review generated UI with AI agents
      list-generators List available generators
      list-agents     List available review agents
      info            Show generator information
      init            Initialize new project
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


@cli.command()
@click.option(
    '--page',
    '-p',
    type=str,
    required=True,
    help='Page name to review (e.g., home, about)'
)
@click.option(
    '--html',
    type=click.Path(exists=True),
    help='Path to HTML file. If not specified, reads from output/final/{page}.html'
)
@click.option(
    '--css',
    type=click.Path(exists=True),
    help='Path to CSS file. If not specified, reads from output/final/{page}.css'
)
@click.option(
    '--js',
    type=click.Path(exists=True),
    help='Path to JavaScript file. If not specified, reads from output/final/{page}.js'
)
@click.option(
    '--all',
    'run_all',
    is_flag=True,
    help='Run all agents (SEO, UX, Accessibility, Marketing)'
)
@click.option(
    '--seo',
    is_flag=True,
    help='Run SEO agent only'
)
@click.option(
    '--ux',
    is_flag=True,
    help='Run UX agent only'
)
@click.option(
    '--a11y',
    'accessibility',
    is_flag=True,
    help='Run Accessibility agent only'
)
@click.option(
    '--marketing',
    is_flag=True,
    help='Run Marketing agent only'
)
@click.option(
    '--design',
    is_flag=True,
    help='Run Design agent only'
)
@click.option(
    '--technical',
    is_flag=True,
    help='Run Technical/QA agent only'
)
@click.option(
    '--output',
    '-o',
    type=click.Path(),
    help='Output directory for review results (default: output/reviews/)'
)
@click.option(
    '--format',
    '-f',
    type=click.Choice(['json', 'markdown', 'both']),
    default='both',
    help='Output format (default: both)'
)
@click.option(
    '--show-cost',
    is_flag=True,
    help='Show cost estimate before running review'
)
@click.option(
    '--parallel/--sequential',
    default=True,
    help='Run agents in parallel (default) or sequentially'
)
@click.option(
    '--config',
    '-c',
    type=click.Path(exists=True),
    help='Path to configuration file'
)
def review(
    page: str,
    html: Optional[str],
    css: Optional[str],
    js: Optional[str],
    run_all: bool,
    seo: bool,
    ux: bool,
    accessibility: bool,
    marketing: bool,
    design: bool,
    technical: bool,
    output: Optional[str],
    format: str,
    show_cost: bool,
    parallel: bool,
    config: Optional[str]
):
    """
    Review generated UI with AI agents
    
    Analyzes HTML, CSS, and JavaScript for SEO, UX, Accessibility, and Marketing
    optimization opportunities. Provides actionable feedback with severity levels.
    
    Examples:
    
      # Review with all agents
      stitchfy review --page home --all
      
      # Review with specific agents
      stitchfy review --page about --seo --ux
      
      # Review with cost estimate
      stitchfy review --page home --all --show-cost
      
      # Custom file paths
      stitchfy review --page home --html custom/home.html --all
    """
    try:
        # Load configuration
        click.echo("Loading configuration...")
        app_config = ConfigLoader.load(config)
        
        # Determine which agents to run
        agents_to_run = []
        if run_all:
            agents_to_run = ['seo', 'ux', 'accessibility', 'marketing', 'design', 'technical']
        else:
            if seo:
                agents_to_run.append('seo')
            if ux:
                agents_to_run.append('ux')
            if accessibility:
                agents_to_run.append('accessibility')
            if marketing:
                agents_to_run.append('marketing')
            if design:
                agents_to_run.append('design')
            if technical:
                agents_to_run.append('technical')
        
        if not agents_to_run:
            click.echo("Error: No agents specified. Use --all or specify individual agents (--seo, --ux, --a11y, --marketing, --design, --technical)", err=True)
            sys.exit(1)
        
        click.echo(f"Agents to run: {', '.join(agents_to_run)}")
        
        # Load HTML, CSS, JS files
        if html:
            html_path = Path(html)
        else:
            html_path = Path('output/final') / f'{page}.html'
        
        if css:
            css_path = Path(css)
        else:
            css_path = Path('output/final') / f'{page}.css'
        
        if js:
            js_path = Path(js)
        else:
            js_path = Path('output/final') / f'{page}.js'
        
        # Read files
        if not html_path.exists():
            click.echo(f"Error: HTML file not found: {html_path}", err=True)
            click.echo("Tip: Generate UI first with 'stitchfy generate' or specify --html path", err=True)
            sys.exit(1)
        
        click.echo(f"Reading HTML from: {html_path}")
        html_content = html_path.read_text(encoding='utf-8')
        
        css_content = ""
        if css_path.exists():
            click.echo(f"Reading CSS from: {css_path}")
            css_content = css_path.read_text(encoding='utf-8')
        
        js_content = ""
        if js_path.exists():
            click.echo(f"Reading JavaScript from: {js_path}")
            js_content = js_path.read_text(encoding='utf-8')
        
        # Load additional context if available
        project_spec = None
        project_path = Path('project.md')
        if project_path.exists():
            project_spec = project_path.read_text(encoding='utf-8')
        
        brand_guidelines = None
        brand_path = Path('brand.md')
        if brand_path.exists():
            brand_guidelines = brand_path.read_text(encoding='utf-8')
        
        # Create review context
        context = ReviewContext(
            html=html_content,
            css=css_content,
            javascript=js_content,
            page_name=page,
            project_spec=project_spec,
            brand_guidelines=brand_guidelines
        )
        
        # Get API key from config (use OpenAI for agents)
        openai_config = app_config.get_generator_config('gpt')
        if not openai_config or not ConfigLoader.validate_generator_config(openai_config):
            click.echo("Error: OpenAI API key not configured. Agents require OPENAI_API_KEY.", err=True)
            click.echo("Set it in your .env file: OPENAI_API_KEY=sk-...", err=True)
            sys.exit(1)
        
        # Create agent config
        agent_config = AgentConfig(
            api_key=openai_config['api_key'],
            model=openai_config.get('model', 'gpt-4o'),
            temperature=0.3,  # Lower for more consistent reviews
            max_tokens=4000
        )
        
        # Initialize agents
        click.echo("\nInitializing agents...")
        agents = []
        agent_map = {
            'seo': SEOAgent,
            'ux': UXAgent,
            'accessibility': AccessibilityAgent,
            'marketing': MarketingAgent,
            'design': DesignAgent,
            'technical': TechnicalAgent
        }
        
        for agent_name in agents_to_run:
            agent_class = agent_map[agent_name]
            agent = agent_class(agent_config)
            agents.append(agent)
            click.echo(f"  ✓ {agent.get_name()} v{agent.get_version()}")
        
        # Create orchestrator
        orchestrator = ReviewOrchestrator(agents, max_workers=4)
        
        # Show cost estimate if requested
        if show_cost:
            click.echo("\n" + "="*60)
            click.echo("COST ESTIMATE")
            click.echo("="*60)
            
            cost_estimate = orchestrator.get_cost_estimate(context)
            
            click.echo(f"Total agents: {cost_estimate['agent_count']}")
            click.echo(f"Estimated total cost: ${cost_estimate['total_cost_usd']:.4f} USD")
            click.echo(f"Estimated total tokens: {cost_estimate['total_tokens']:,}")
            
            click.echo("\nBreakdown by agent:")
            for est in cost_estimate['breakdown']:
                click.echo(f"  {est['agent_name']}: ${est['estimated_cost_usd']:.4f}")
            
            click.echo("="*60 + "\n")
            
            if not click.confirm("Continue with review?"):
                click.echo("Review cancelled.")
                return
        
        # Run review
        click.echo(f"\nRunning review ({'parallel' if parallel else 'sequential'})...")
        click.echo("This may take a moment...\n")
        
        result = orchestrator.review(context, parallel=parallel)
        
        # Display results
        click.echo("\n" + "="*60)
        click.echo("REVIEW COMPLETE")
        click.echo("="*60)
        click.echo(f"Page: {result.page_name}")
        click.echo(f"Overall Score: {result.overall_score}/100")
        click.echo(f"Total Issues: {result.total_feedback_items}")
        click.echo(f"Critical: {result.critical_items_count} | High Priority: {result.high_priority_items_count}")
        click.echo("="*60)
        
        # Show summary
        click.echo(f"\n{result.summary}\n")
        
        # Show top priorities
        if result.top_priorities:
            click.echo("Top Priorities:")
            for i, priority in enumerate(result.top_priorities[:5], 1):
                click.echo(f"  {i}. {priority}")
            click.echo()
        
        # Show agent scores
        click.echo("Agent Scores:")
        for feedback in result.agent_feedbacks:
            score_color = "green" if feedback.overall_score >= 80 else "yellow" if feedback.overall_score >= 60 else "red"
            click.echo(f"  {feedback.agent_name}: {feedback.overall_score}/100", nl=False)
            click.secho(f" ({len(feedback.feedback_items)} issues)", fg=score_color)
        
        # Determine output directory
        output_dir = output or 'output/reviews'
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Save results
        click.echo(f"\nSaving results to: {output_path}")
        
        if format in ['json', 'both']:
            json_file = output_path / f'{page}_review.json'
            result.save_to_file(str(json_file))
            click.echo(f"  ✓ JSON: {json_file}")
        
        if format in ['markdown', 'both']:
            markdown_file = output_path / f'{page}_review.md'
            markdown_report = result.generate_markdown_report()
            markdown_file.write_text(markdown_report, encoding='utf-8')
            click.echo(f"  ✓ Markdown: {markdown_file}")
        
        click.echo("\n✓ Review successful!")
        
        # Show next steps
        if result.critical_items_count > 0:
            click.echo(f"\n⚠️  {result.critical_items_count} critical issue(s) found. Review the report for details.")
        
    except Exception as e:
        click.echo(f"\nError: {str(e)}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
def list_agents():
    """
    List available review agents and their capabilities
    """
    try:
        # Create a dummy config just to initialize agents
        dummy_config = AgentConfig(
            api_key="dummy",
            model="gpt-4o"
        )
        
        agents = [
            SEOAgent(dummy_config),
            UXAgent(dummy_config),
            AccessibilityAgent(dummy_config),
            MarketingAgent(dummy_config),
            DesignAgent(dummy_config),
            TechnicalAgent(dummy_config),
        ]
        
        click.echo("\n" + "="*60)
        click.echo("AVAILABLE REVIEW AGENTS")
        click.echo("="*60)
        
        for agent in agents:
            info = agent.get_info()
            
            click.echo(f"\n{info['name']} v{info['version']}")
            click.echo(f"  {info['description']}")
            click.echo(f"\n  Focus Areas:")
            for area in info['focus_areas']:
                click.echo(f"    • {area}")
            click.echo(f"\n  Model: {info['model']}")
            click.echo(f"  Structured Output: {'✓' if info['structured_output_enabled'] else '✗'}")
        
        click.echo("\n" + "="*60)
        click.echo("\nUsage:")
        click.echo("  stitchfy review --page home --all")
        click.echo("  stitchfy review --page about --seo --ux")
        click.echo("="*60 + "\n")
        
    except Exception as e:
        click.echo(f"\nError: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.option(
    '--page',
    '-p',
    type=str,
    required=True,
    help='Page name to refine'
)
@click.option(
    '--prompt',
    type=click.Path(exists=True),
    help='Path to original prompt file. If not specified, reads from pages/{page}.md'
)
@click.option(
    '--generator',
    '-g',
    type=str,
    help='Generator to use for refinement (default: from config)'
)
@click.option(
    '--iterations',
    '-i',
    type=int,
    default=3,
    help='Maximum refinement iterations (default: 3)'
)
@click.option(
    '--target-score',
    type=float,
    default=90.0,
    help='Target score to achieve (default: 90.0)'
)
@click.option(
    '--convergence-threshold',
    type=float,
    default=2.0,
    help='Minimum improvement to continue (default: 2.0 points)'
)
@click.option(
    '--output',
    '-o',
    type=click.Path(),
    help='Output directory for refined files (default: output/final/)'
)
@click.option(
    '--config',
    '-c',
    type=click.Path(exists=True),
    help='Path to configuration file'
)
def refine(
    page: str,
    prompt: Optional[str],
    generator: Optional[str],
    iterations: int,
    target_score: float,
    convergence_threshold: float,
    output: Optional[str],
    config: Optional[str]
):
    """
    Iteratively refine generated UI based on agent feedback
    
    Performs multiple cycles of review and regeneration until the page
    reaches the target score or maximum iterations.
    
    Examples:
    
      # Refine with default settings (3 iterations, target 90)
      stitchfy refine --page home
      
      # Refine with custom iterations and target
      stitchfy refine --page about --iterations 5 --target-score 95
      
      # Refine with specific generator
      stitchfy refine --page home --generator claude
    """
    try:
        # Load configuration
        click.echo("Loading configuration...")
        app_config = ConfigLoader.load(config)
        
        # Determine generator
        generator_name = generator or app_config.default_generator
        click.echo(f"Using generator: {generator_name}")
        
        # Get generator config
        gen_config_dict = app_config.get_generator_config(generator_name)
        if not gen_config_dict or not ConfigLoader.validate_generator_config(gen_config_dict):
            click.echo(f"Error: Invalid generator configuration for '{generator_name}'", err=True)
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
        original_prompt = prompt_path.read_text(encoding='utf-8')
        
        # Create generator
        gen_config = GeneratorConfig(**gen_config_dict)
        gen = GeneratorFactory.create_generator(generator_name, gen_config)
        
        # Create agent config
        openai_config = app_config.get_generator_config('gpt')
        if not openai_config or not ConfigLoader.validate_generator_config(openai_config):
            click.echo("Error: OpenAI API key required for agents", err=True)
            sys.exit(1)
        
        agent_config = AgentConfig(
            api_key=openai_config['api_key'],
            model='gpt-4o',
            temperature=0.3,
            max_tokens=4000
        )
        
        # Initialize agents
        click.echo("\nInitializing agents...")
        agents = [
            SEOAgent(agent_config),
            UXAgent(agent_config),
            AccessibilityAgent(agent_config),
            MarketingAgent(agent_config),
            DesignAgent(agent_config),
            TechnicalAgent(agent_config),
        ]
        
        for agent in agents:
            click.echo(f"  ✓ {agent.get_name()} v{agent.get_version()}")
        
        # Create orchestrator
        orchestrator = ReviewOrchestrator(agents, max_workers=4)
        
        # Create refiner
        refiner = Refiner(
            generator=gen,
            orchestrator=orchestrator,
            max_iterations=iterations,
            convergence_threshold=convergence_threshold,
            target_score=target_score
        )
        
        click.echo(f"\n" + "="*60)
        click.echo("REFINEMENT CONFIGURATION")
        click.echo("="*60)
        click.echo(f"Page: {page}")
        click.echo(f"Generator: {gen.get_name()}")
        click.echo(f"Max iterations: {iterations}")
        click.echo(f"Target score: {target_score}")
        click.echo(f"Convergence threshold: {convergence_threshold} points")
        click.echo("="*60 + "\n")
        
        if not click.confirm("Start refinement process?"):
            click.echo("Refinement cancelled.")
            return
        
        # Run refinement
        click.echo("\nStarting refinement process...")
        click.echo("This may take several minutes...\n")
        
        result = refiner.refine(
            page_name=page,
            initial_prompt=original_prompt
        )
        
        # Display results
        click.echo("\n" + "="*60)
        click.echo("REFINEMENT COMPLETE")
        click.echo("="*60)
        click.echo(f"Page: {result.page_name}")
        click.echo(f"Initial Score: {result.initial_score:.1f}/100")
        click.echo(f"Final Score: {result.final_score:.1f}/100")
        click.echo(f"Total Improvement: +{result.total_improvement:.1f} points")
        click.echo(f"Iterations: {len(result.iterations)}")
        click.echo(f"Converged: {'Yes' if result.converged else 'No'}")
        click.echo(f"Reason: {result.convergence_reason}")
        click.echo("="*60)
        
        # Show iteration progress
        if result.iterations:
            click.echo("\nIteration Progress:")
            for iteration in result.iterations:
                improvement_color = "green" if iteration.score_improvement > 0 else "red"
                click.echo(
                    f"  {iteration.iteration_number}. {iteration.before_score:.1f} → "
                    f"{iteration.after_score:.1f} ",
                    nl=False
                )
                click.secho(
                    f"(+{iteration.score_improvement:.1f})",
                    fg=improvement_color
                )
        
        # Save results
        output_dir = output or 'output/final'
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        refinement_dir = Path('output/refinements')
        refinement_dir.mkdir(parents=True, exist_ok=True)
        
        click.echo(f"\nSaving results...")
        
        # Save final UI
        if result.iterations:
            final_ui = result.iterations[-1].ui_output
            saved_files = final_ui.save_to_files(str(output_path))
            click.echo(f"\nFinal UI saved to: {output_path}")
            for file_type, file_path in saved_files.items():
                click.echo(f"  ✓ {file_type}: {file_path}")
        
        # Save refinement report
        refinement_json = refinement_dir / f'{page}_refinement.json'
        result.save_to_file(str(refinement_json))
        click.echo(f"\n✓ Refinement report: {refinement_json}")
        
        # Save summary
        summary_md = refinement_dir / f'{page}_refinement_summary.md'
        summary_md.write_text(result.generate_summary_report(), encoding='utf-8')
        click.echo(f"✓ Summary report: {summary_md}")
        
        click.echo("\n✓ Refinement successful!")
        
        # Show recommendations
        if result.final_score >= target_score:
            click.echo(f"\n🎉 Target score of {target_score} achieved!")
        elif result.final_score < result.initial_score:
            click.echo(f"\n⚠️  Score decreased. Consider reviewing the feedback manually.")
        elif not result.converged:
            click.echo(f"\n💡 Consider running more iterations to reach target score.")
        
    except Exception as e:
        click.echo(f"\nError: {str(e)}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    cli()
