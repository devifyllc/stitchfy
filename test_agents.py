#!/usr/bin/env python3
"""
Test script for Stitchfy Agent Architecture

Tests the agent system without making actual API calls.
Validates architecture, data models, and orchestration.
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.agents.base_agent import (
    AgentConfig,
    ReviewContext,
    FeedbackItem,
    FeedbackSeverity,
    FeedbackCategory,
    AgentFeedback,
)
from src.agents.seo_agent import SEOAgent
from src.agents.ux_agent import UXAgent
from src.agents.accessibility_agent import AccessibilityAgent
from src.agents.marketing_agent import MarketingAgent
from src.agents.orchestrator import ReviewOrchestrator


def test_data_models():
    """Test data model creation and methods"""
    print("Testing data models...")
    
    # Test FeedbackItem
    item = FeedbackItem(
        category=FeedbackCategory.SEO_METADATA,
        severity=FeedbackSeverity.HIGH,
        title="Missing meta description",
        description="Page lacks meta description",
        current_state="No meta tag present",
        suggested_improvement="Add <meta name='description' content='...'>",
        impact="Improves CTR from search results",
        code_reference="<head> section"
    )
    
    assert item.severity == FeedbackSeverity.HIGH
    assert item.category == FeedbackCategory.SEO_METADATA
    
    item_dict = item.to_dict()
    assert "title" in item_dict
    assert item_dict["severity"] == "high"
    
    print("  ✓ FeedbackItem works correctly")
    
    # Test AgentFeedback
    feedback = AgentFeedback(
        agent_name="Test Agent",
        agent_version="1.0.0",
        review_timestamp="2024-01-01T00:00:00",
        page_name="home",
        overall_score=85.5,
        summary="Good quality with some improvements needed",
        feedback_items=[item],
        strengths=["Good structure", "Clear navigation"],
        priorities=["Add meta description", "Optimize images"],
        metadata={"test": True}
    )
    
    assert feedback.overall_score == 85.5
    assert len(feedback.feedback_items) == 1
    
    # Test filtering methods
    high_priority = feedback.get_high_priority_items()
    assert len(high_priority) == 1
    
    seo_items = feedback.get_items_by_category(FeedbackCategory.SEO_METADATA)
    assert len(seo_items) == 1
    
    print("  ✓ AgentFeedback works correctly")
    
    # Test ReviewContext
    context = ReviewContext(
        html="<html><body><h1>Test</h1></body></html>",
        css="body { margin: 0; }",
        javascript="console.log('test');",
        page_name="test",
        target_audience="Developers",
        metadata={"version": "1.0"}
    )
    
    assert context.page_name == "test"
    context_dict = context.to_dict()
    assert "html" in context_dict
    
    print("  ✓ ReviewContext works correctly")


def test_agent_config():
    """Test agent configuration"""
    print("\nTesting AgentConfig...")
    
    config = AgentConfig(
        api_key="sk-test-key",
        model="gpt-4o",
        temperature=0.3,
        max_tokens=4000
    )
    
    # Should not raise
    config.validate()
    
    print("  ✓ Valid config passes validation")
    
    # Test invalid config
    try:
        invalid_config = AgentConfig(
            api_key="",
            model="gpt-4o"
        )
        invalid_config.validate()
        assert False, "Should have raised ValueError"
    except ValueError:
        print("  ✓ Invalid config raises ValueError")


def test_agent_initialization():
    """Test agent initialization and metadata"""
    print("\nTesting agent initialization...")
    
    config = AgentConfig(
        api_key="sk-test-key",
        model="gpt-4o",
        temperature=0.3,
        max_tokens=4000
    )
    
    # Test SEO Agent
    seo_agent = SEOAgent(config)
    assert seo_agent.get_name() == "SEO Agent"
    assert seo_agent.get_version() == "1.0.0"
    assert len(seo_agent.get_review_focus_areas()) > 0
    
    info = seo_agent.get_info()
    assert info["name"] == "SEO Agent"
    assert info["model"] == "gpt-4o"
    
    print(f"  ✓ {seo_agent.get_name()} initialized")
    
    # Test UX Agent
    ux_agent = UXAgent(config)
    assert ux_agent.get_name() == "UX Agent"
    print(f"  ✓ {ux_agent.get_name()} initialized")
    
    # Test Accessibility Agent
    a11y_agent = AccessibilityAgent(config)
    assert a11y_agent.get_name() == "Accessibility Agent"
    print(f"  ✓ {a11y_agent.get_name()} initialized")
    
    # Test Marketing Agent
    marketing_agent = MarketingAgent(config)
    assert marketing_agent.get_name() == "Marketing Agent"
    print(f"  ✓ {marketing_agent.get_name()} initialized")


def test_prompt_generation():
    """Test prompt generation"""
    print("\nTesting prompt generation...")
    
    config = AgentConfig(
        api_key="sk-test-key",
        model="gpt-4o",
        custom_instructions="Focus on mobile optimization"
    )
    
    agent = SEOAgent(config)
    
    # Test system prompt
    system_prompt = agent._build_system_prompt()
    assert len(system_prompt) > 0
    assert "SEO" in system_prompt
    assert "Focus on mobile optimization" in system_prompt
    
    print("  ✓ System prompt generated correctly")
    
    # Test user prompt
    context = ReviewContext(
        html="<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>",
        css="body { margin: 0; }",
        javascript="",
        page_name="home",
        target_audience="Small business owners"
    )
    
    user_prompt = agent._build_user_prompt(context)
    assert len(user_prompt) > 0
    assert "home" in user_prompt
    assert "Small business owners" in user_prompt
    assert "<h1>Hello</h1>" in user_prompt
    
    print("  ✓ User prompt generated correctly")


def test_structured_output_schema():
    """Test structured output schemas"""
    print("\nTesting structured output schemas...")
    
    config = AgentConfig(api_key="sk-test-key", model="gpt-4o")
    
    agents = [
        SEOAgent(config),
        UXAgent(config),
        AccessibilityAgent(config),
        MarketingAgent(config),
    ]
    
    for agent in agents:
        schema = agent._get_structured_output_schema()
        
        # Validate schema structure
        assert "type" in schema
        assert schema["type"] == "object"
        assert "properties" in schema
        assert "required" in schema
        
        # Check required fields
        required = schema["required"]
        assert "overall_score" in required
        assert "summary" in required
        assert "feedback_items" in required
        
        print(f"  ✓ {agent.get_name()} schema is valid")


def test_cost_estimation():
    """Test cost estimation"""
    print("\nTesting cost estimation...")
    
    config = AgentConfig(api_key="sk-test-key", model="gpt-4o")
    agent = SEOAgent(config)
    
    context = ReviewContext(
        html="<html><body><h1>Test</h1></body></html>",
        css="body { margin: 0; }",
        javascript="",
        page_name="test"
    )
    
    estimate = agent.get_cost_estimate(context)
    
    assert "agent_name" in estimate
    assert "estimated_cost_usd" in estimate
    assert "estimated_total_tokens" in estimate
    assert estimate["estimated_cost_usd"] > 0
    
    print(f"  ✓ Cost estimate: ${estimate['estimated_cost_usd']:.4f}")


def test_orchestrator():
    """Test review orchestrator"""
    print("\nTesting ReviewOrchestrator...")
    
    config = AgentConfig(api_key="sk-test-key", model="gpt-4o")
    
    agents = [
        SEOAgent(config),
        UXAgent(config),
        AccessibilityAgent(config),
        MarketingAgent(config),
    ]
    
    orchestrator = ReviewOrchestrator(agents, max_workers=4)
    
    # Test agent listing
    agent_list = orchestrator.list_agents()
    assert len(agent_list) == 4
    assert all("name" in info for info in agent_list)
    
    print(f"  ✓ Orchestrator initialized with {len(agents)} agents")
    
    # Test cost estimation
    context = ReviewContext(
        html="<html><body><h1>Test</h1></body></html>",
        css="body { margin: 0; }",
        javascript="",
        page_name="test"
    )
    
    total_estimate = orchestrator.get_cost_estimate(context)
    assert "total_cost_usd" in total_estimate
    assert "agent_count" in total_estimate
    assert total_estimate["agent_count"] == 4
    
    print(f"  ✓ Total cost estimate: ${total_estimate['total_cost_usd']:.4f}")
    print(f"  ✓ Estimated tokens: {total_estimate['total_tokens']:,}")


def test_enums():
    """Test enum definitions"""
    print("\nTesting enums...")
    
    # Test FeedbackSeverity
    assert FeedbackSeverity.CRITICAL.value == "critical"
    assert FeedbackSeverity.HIGH.value == "high"
    assert FeedbackSeverity.MEDIUM.value == "medium"
    assert FeedbackSeverity.LOW.value == "low"
    assert FeedbackSeverity.INFO.value == "info"
    
    print("  ✓ FeedbackSeverity enum is correct")
    
    # Test FeedbackCategory
    seo_categories = [
        FeedbackCategory.SEO_METADATA,
        FeedbackCategory.SEO_STRUCTURE,
        FeedbackCategory.SEO_CONTENT,
        FeedbackCategory.SEO_PERFORMANCE,
    ]
    assert all(cat.value.startswith("seo_") for cat in seo_categories)
    
    ux_categories = [
        FeedbackCategory.UX_NAVIGATION,
        FeedbackCategory.UX_LAYOUT,
        FeedbackCategory.UX_INTERACTION,
        FeedbackCategory.UX_VISUAL_HIERARCHY,
        FeedbackCategory.UX_MOBILE,
    ]
    assert all(cat.value.startswith("ux_") for cat in ux_categories)
    
    print("  ✓ FeedbackCategory enum is correct")


def main():
    """Run all tests"""
    print("=" * 70)
    print("Stitchfy Agent Architecture - Test Suite")
    print("=" * 70)
    
    try:
        test_enums()
        test_data_models()
        test_agent_config()
        test_agent_initialization()
        test_prompt_generation()
        test_structured_output_schema()
        test_cost_estimation()
        test_orchestrator()
        
        print("\n" + "=" * 70)
        print("✓ All architecture tests passed!")
        print("=" * 70)
        print("\nAgent System Summary:")
        print("  • 4 specialized agents (SEO, UX, Accessibility, Marketing)")
        print("  • Structured output with OpenAI")
        print("  • Parallel execution support")
        print("  • Comprehensive feedback system")
        print("  • Cost estimation and tracking")
        print("\nNext Steps:")
        print("  1. Set up API key: export OPENAI_API_KEY='your-key'")
        print("  2. Test with real API: python3 test_agents_live.py")
        print("  3. Integrate with CLI: python3 -m src.cli.commands review")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
