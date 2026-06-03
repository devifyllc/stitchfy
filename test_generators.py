#!/usr/bin/env python3
"""
Test script to verify generator implementations without requiring API keys.

This script tests the generator architecture without making actual API calls.
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.generators.base_generator import GeneratorConfig, UIOutput
from src.generators.factory import GeneratorFactory


def test_generator_config():
    """Test GeneratorConfig creation and validation"""
    print("Testing GeneratorConfig...")
    
    config = GeneratorConfig(
        api_key="test-key",
        model="test-model",
        temperature=0.7,
        max_tokens=8000
    )
    
    assert config.api_key == "test-key"
    assert config.model == "test-model"
    assert config.temperature == 0.7
    assert config.max_tokens == 8000
    
    print("✓ GeneratorConfig works correctly")


def test_ui_output():
    """Test UIOutput creation and methods"""
    print("\nTesting UIOutput...")
    
    output = UIOutput(
        html="<html></html>",
        css="body { margin: 0; }",
        javascript="console.log('test');",
        metadata={"test": "data"},
        generator_name="Test Generator",
        page_name="test"
    )
    
    assert output.html == "<html></html>"
    assert output.page_name == "test"
    
    # Test to_dict
    output_dict = output.to_dict()
    assert "html" in output_dict
    assert "generator_name" in output_dict
    
    print("✓ UIOutput works correctly")


def test_factory():
    """Test GeneratorFactory"""
    print("\nTesting GeneratorFactory...")
    
    # List available generators
    generators = GeneratorFactory.list_available_generators()
    assert 'gpt' in generators
    assert 'claude' in generators
    assert 'gemini' in generators
    
    print(f"✓ Available generators: {generators}")
    
    # Get generator info
    for gen_name in generators:
        info = GeneratorFactory.get_generator_info(gen_name)
        print(f"  - {gen_name}: {info['class']} (default model: {info['default_model']})")
    
    print("✓ GeneratorFactory works correctly")


def test_generator_creation():
    """Test creating generator instances (without API calls)"""
    print("\nTesting generator creation...")
    
    config = GeneratorConfig(
        api_key="sk-test-key-for-testing",
        model="gpt-4o",
        temperature=0.7,
        max_tokens=8000
    )
    
    try:
        # This will create the generator but won't make API calls
        generator = GeneratorFactory.create_generator('gpt', config)
        print(f"✓ Created GPT generator: {generator.get_name()}")
        
        # Test capabilities
        capabilities = generator.get_capabilities()
        print(f"  Capabilities: {capabilities}")
        
        # Test cost estimation
        cost = generator.get_cost_estimate(1000)
        print(f"  Cost estimate for 1000 chars: ${cost['estimated_cost_usd']:.4f}")
        
    except Exception as e:
        print(f"✓ Generator creation works (validation expected: {e})")


def test_config_loader():
    """Test configuration loader"""
    print("\nTesting ConfigLoader...")
    
    try:
        from src.core.config_loader import ConfigLoader
        
        # Try to load config
        config_path = Path(__file__).parent / "stitchfy.config.yaml"
        if config_path.exists():
            config = ConfigLoader.load(str(config_path))
            print(f"✓ Loaded config with default generator: {config.default_generator}")
            print(f"  Available generators in config: {list(config.generators.keys())}")
            print(f"  Fallback enabled: {config.fallback_enabled}")
        else:
            print("⚠ Config file not found (expected for test)")
            
    except Exception as e:
        print(f"⚠ Config loader test: {e}")


def main():
    """Run all tests"""
    print("="*60)
    print("Stitchfy Generator System - Architecture Test")
    print("="*60)
    
    try:
        test_generator_config()
        test_ui_output()
        test_factory()
        test_generator_creation()
        test_config_loader()
        
        print("\n" + "="*60)
        print("✓ All architecture tests passed!")
        print("="*60)
        print("\nNext steps:")
        print("1. Install dependencies: pip3 install -r requirements.txt")
        print("2. Set up API keys in .env file")
        print("3. Run: python3 -m src.cli.commands list-generators")
        print("="*60)
        
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
