# Stitchfy Multi-Generator System Guide

## Overview

Stitchfy's multi-generator system allows you to choose from multiple AI providers (OpenAI GPT, Anthropic Claude, Google Gemini) for generating website UI code. This guide explains how to use and configure the system.

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Up API Keys

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` and add keys for the providers you want to use:

```bash
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_API_KEY=AIza-your-google-key
```

### 3. Configure Generators

Edit `stitchfy.config.yaml` to set your default generator and preferences:

```yaml
default_generator: gpt  # or claude, or gemini

generators:
  gpt:
    api_key: ${OPENAI_API_KEY}
    model: gpt-4o
    temperature: 0.7
    max_tokens: 8000
```

### 4. Generate UI

```bash
# Use default generator
python stitchfy generate

# Use specific generator
python stitchfy generate --generator claude

# Show cost estimate first
python stitchfy generate --show-cost
```

## Generator Comparison

### OpenAI GPT-4

**Best for**: General-purpose UI generation, balanced performance

**Pros**:
- Excellent code quality
- Well-documented and widely used
- Reliable and consistent output
- Good at following complex instructions

**Cons**:
- Moderate cost ($5-15/1M tokens)
- Requires OpenAI account

**Recommended models**:
- `gpt-4o` - Latest, fastest GPT-4 model
- `gpt-4o-mini` - Cost-effective alternative
- `gpt-4-turbo` - High performance

### Anthropic Claude

**Best for**: Complex reasoning, long-context projects

**Pros**:
- Superior reasoning capabilities
- Excellent at understanding context
- Very good code generation
- Large context window (200K tokens)

**Cons**:
- Similar cost to GPT-4
- Requires Anthropic account

**Recommended models**:
- `claude-3-5-sonnet-20241022` - Latest, best performance
- `claude-3-opus-20240229` - Highest capability
- `claude-3-haiku-20240307` - Fastest, most affordable

### Google Gemini

**Best for**: Speed, efficiency, multimodal projects

**Pros**:
- Very fast generation
- Low cost (often free tier available)
- Huge context window (1M tokens)
- Multimodal capabilities

**Cons**:
- Newer, less battle-tested
- API availability varies by region

**Recommended models**:
- `gemini-2.0-flash-exp` - Experimental, free
- `gemini-1.5-pro` - High performance
- `gemini-1.5-flash` - Fast and affordable

## Configuration Options

### Generator-Specific Settings

Each generator can be configured with:

```yaml
generators:
  gpt:
    api_key: ${OPENAI_API_KEY}      # API key (from env var)
    model: gpt-4o                    # Model to use
    temperature: 0.7                 # Creativity (0-2)
    max_tokens: 8000                 # Max output length
    additional_params: {}            # Provider-specific params
```

### Fallback Strategy

Enable automatic fallback to alternative generators:

```yaml
fallback_enabled: true
fallback_generators:
  - claude
  - gpt
  - gemini
```

When enabled, if the primary generator fails, Stitchfy will automatically try the fallback generators in order.

### Cost Tracking

Configure cost estimation and warnings:

```yaml
cost_tracking:
  enabled: true
  warn_threshold: 1.00      # Warn if cost > $1
  confirm_threshold: 5.00   # Require confirmation if cost > $5
```

## CLI Commands

### Generate UI

```bash
# Basic generation
stitchfy generate

# Specify generator
stitchfy generate --generator gpt
stitchfy generate --generator claude
stitchfy generate --generator gemini

# Specify page
stitchfy generate --page about

# Custom prompt file
stitchfy generate --prompt path/to/prompt.md

# Custom output directory
stitchfy generate --output custom/output/dir

# Show cost estimate
stitchfy generate --show-cost

# Enable fallback
stitchfy generate --with-fallback

# Combine options
stitchfy generate --page services --generator claude --show-cost
```

### List Generators

```bash
# Show all available generators and their status
stitchfy list-generators
```

Output:
```
GPT
  Class: GPTGenerator
  Default model: gpt-4o
  Status: ✓ Configured

CLAUDE
  Class: ClaudeGenerator
  Default model: claude-3-5-sonnet-20241022
  Status: ✓ Configured
```

### Generator Info

```bash
# Get detailed info about a generator
stitchfy info gpt
stitchfy info claude
stitchfy info gemini
```

### Initialize Project

```bash
# Create new Stitchfy project
stitchfy init my-website
```

## Advanced Usage

### Custom Generator Configuration

You can override configuration per-command:

```bash
# Use different config file
stitchfy generate --config custom-config.yaml
```

### Programmatic Usage

Use Stitchfy generators in your Python code:

```python
from src.generators.factory import GeneratorFactory
from src.generators.base_generator import GeneratorConfig

# Create generator config
config = GeneratorConfig(
    api_key="your-api-key",
    model="gpt-4o",
    temperature=0.7,
    max_tokens=8000
)

# Create generator
generator = GeneratorFactory.create_generator('gpt', config)

# Generate UI
output = generator.generate_ui(
    optimized_prompt="Create a modern homepage...",
    page_name="home"
)

# Save output
output.save_to_files('output/final')
```

### Custom Generators

Register custom generators:

```python
from src.generators.factory import GeneratorFactory
from src.generators.base_generator import BaseGenerator

class MyCustomGenerator(BaseGenerator):
    # Implement required methods
    pass

# Register
GeneratorFactory.register_generator(
    'custom',
    MyCustomGenerator,
    default_model='my-model'
)
```

## Troubleshooting

### API Key Not Found

**Error**: `Invalid configuration for generator 'gpt'. Make sure API key is set`

**Solution**: 
1. Check that `.env` file exists
2. Verify API key is set: `echo $OPENAI_API_KEY`
3. Make sure environment variables are loaded

### Generator Not Available

**Error**: `Unknown generator type: 'xyz'`

**Solution**: Use one of the supported generators: `gpt`, `claude`, `gemini`

### Cost Too High

**Error**: Cost estimate exceeds threshold

**Solution**:
1. Use a more affordable model (e.g., `gpt-4o-mini`, `claude-haiku`)
2. Reduce `max_tokens` in configuration
3. Shorten your prompt
4. Adjust cost thresholds in config

### Rate Limiting

**Error**: API rate limit exceeded

**Solution**:
1. Wait and retry
2. Use fallback generators: `--with-fallback`
3. Upgrade your API plan
4. Switch to a different generator

## Best Practices

1. **Start with cost estimation**: Use `--show-cost` to preview costs
2. **Enable fallback**: Use `--with-fallback` for production reliability
3. **Choose the right generator**:
   - GPT-4: General purpose, reliable
   - Claude: Complex reasoning, long context
   - Gemini: Speed and efficiency
4. **Secure API keys**: Never commit `.env` to version control
5. **Monitor costs**: Track usage across different generators
6. **Test multiple generators**: Compare output quality for your use case

## Cost Optimization

### Tips to Reduce Costs

1. **Use smaller models**:
   - `gpt-4o-mini` instead of `gpt-4o`
   - `claude-haiku` instead of `claude-opus`
   - `gemini-flash` instead of `gemini-pro`

2. **Reduce max_tokens**:
   ```yaml
   max_tokens: 4000  # Instead of 8000
   ```

3. **Optimize prompts**: Shorter, clearer prompts = lower costs

4. **Use Gemini for development**: Free tier available

5. **Batch operations**: Generate multiple pages in one session

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Contact: cardozo@devifyllc.com
- Documentation: See README.md

---

**Stitchfy Multi-Generator System** - Flexible, powerful, cost-effective UI generation.
