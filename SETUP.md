# Stitchfy Setup Guide

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

## Installation Steps

### 1. Install Python Dependencies

```bash
pip3 install -r requirements.txt
```

Or install individually:

```bash
pip3 install pyyaml click openai anthropic google-generativeai python-dotenv
```

### 2. Set Up Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your API keys
nano .env  # or use your preferred editor
```

Add your API keys (you only need keys for generators you plan to use):

```bash
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
GOOGLE_API_KEY=AIza-your-google-key-here
```

### 3. Make CLI Executable (Optional)

```bash
chmod +x stitchfy
```

### 4. Test Installation

```bash
# Test with Python module syntax
python3 -m src.cli.commands --help

# Or if you made it executable
./stitchfy --help
```

## Getting API Keys

### OpenAI (for GPT generators)
1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Create a new API key
4. Copy the key (starts with `sk-`)

### Anthropic (for Claude generators)
1. Go to https://console.anthropic.com/settings/keys
2. Sign up or log in
3. Create a new API key
4. Copy the key (starts with `sk-ant-`)

### Google (for Gemini generators)
1. Go to https://makersuite.google.com/app/apikey
2. Sign up or log in
3. Create a new API key
4. Copy the key (starts with `AIza`)

## Verify Setup

```bash
# List available generators
python3 -m src.cli.commands list-generators

# Check if generators are configured
python3 -m src.cli.commands info gpt
python3 -m src.cli.commands info claude
python3 -m src.cli.commands info gemini
```

## Troubleshooting

### "ModuleNotFoundError"
**Problem**: Missing Python dependencies

**Solution**:
```bash
pip3 install -r requirements.txt
```

### "Invalid configuration for generator"
**Problem**: API key not set or not found

**Solution**:
1. Check that `.env` file exists
2. Verify API keys are set correctly
3. Make sure there are no extra spaces
4. Try loading env vars manually:
   ```bash
   export OPENAI_API_KEY=your-key-here
   ```

### "Configuration file not found"
**Problem**: `stitchfy.config.yaml` not in current directory

**Solution**:
1. Make sure you're in the stitchfy directory
2. Verify the config file exists: `ls stitchfy.config.yaml`

## Next Steps

Once setup is complete:

1. **Test generation** (will use default generator from config):
   ```bash
   python3 -m src.cli.commands generate --help
   ```

2. **Read the guides**:
   - `README.md` - Project overview
   - `MULTI_GENERATOR_GUIDE.md` - Detailed usage guide
   - `IMPLEMENTATION_SUMMARY.md` - Technical details

3. **Start generating**:
   ```bash
   python3 -m src.cli.commands generate --page home --show-cost
   ```

## Quick Reference

```bash
# Using Python module syntax (always works)
python3 -m src.cli.commands <command>

# Using executable (after chmod +x)
./stitchfy <command>

# Common commands
python3 -m src.cli.commands generate
python3 -m src.cli.commands list-generators
python3 -m src.cli.commands info gpt
python3 -m src.cli.commands init my-project
```

---

**Ready to generate!** 🚀
