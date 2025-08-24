/**
 * LLM Factory
 * 
 * Factory pattern implementation for creating LLM service instances
 * based on configuration. Supports multiple providers: Gemini, Ollama, Anthropic, OpenAI.
 */

import { LLMService, LLMProvider } from './llm-interface';
import { LLMError, LLMUnavailableError } from '../types/llm';
import { config, getProviderConfig } from '../utils/config';
import { logger } from '../utils/logger';

// Import provider services
import { GeminiService } from './gemini-service';
import { AnthropicService } from './anthropic-service';
// Note: These will be imported as we implement them
// import { OllamaService } from './ollama-service';
// import { OpenAIService } from './openai-service';

/**
 * LLM Factory for creating provider instances
 */
export class LLMFactory {
  private static instance: LLMService | null = null;
  private static currentProvider: string | null = null;

  /**
   * Create or return existing LLM service instance
   * Uses singleton pattern to avoid multiple instances of the same provider
   */
  static createLLMService(overrideProvider?: string): LLMService {
    const providerConfig = getProviderConfig();
    const requestedProvider = overrideProvider || providerConfig.provider;

    // If we already have an instance of the requested provider, return it
    if (this.instance && this.currentProvider === requestedProvider) {
      return this.instance;
    }

    // Create new instance
    logger.info('Creating new LLM service instance', {
      provider: requestedProvider,
      model: providerConfig.model,
      previousProvider: this.currentProvider
    });

    try {
      this.instance = this.instantiateProvider(requestedProvider as LLMProvider);
      this.currentProvider = requestedProvider;
      return this.instance;
    } catch (error) {
      logger.error('Failed to create LLM service instance', {
        provider: requestedProvider,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create a specific provider instance (for testing or specific use cases)
   */
  static createSpecificProvider(provider: LLMProvider): LLMService {
    return this.instantiateProvider(provider);
  }

  /**
   * Get list of available providers (checking if they're properly configured)
   */
  static async getAvailableProviders(): Promise<LLMProvider[]> {
    const availableProviders: LLMProvider[] = [];
    const providers = [LLMProvider.GEMINI, LLMProvider.OLLAMA, LLMProvider.ANTHROPIC, LLMProvider.OPENAI];

    for (const provider of providers) {
      try {
        const service = this.instantiateProvider(provider);
        if (await service.isAvailable()) {
          availableProviders.push(provider);
        }
      } catch (error) {
        logger.debug(`Provider ${provider} not available`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return availableProviders;
  }

  /**
   * Reset factory (useful for testing or configuration changes)
   */
  static reset(): void {
    this.instance = null;
    this.currentProvider = null;
    logger.debug('LLM Factory reset');
  }

  /**
   * Get provider info for the current instance
   */
  static getCurrentProviderInfo(): { provider: LLMProvider; model: string } | null {
    if (!this.instance) {
      return null;
    }
    return this.instance.getProviderInfo();
  }

  /**
   * Validate provider configuration before instantiation
   */
  private static validateProviderConfiguration(provider: LLMProvider): void {
    const providerConfig = getProviderConfig();
    
    switch (provider) {
      case LLMProvider.GEMINI:
        if (!config.GEMINI_API_KEY) {
          throw new LLMError(provider, 'CONFIG_ERROR', 'GEMINI_API_KEY is required');
        }
        break;
        
      case LLMProvider.ANTHROPIC:
        if (!config.ANTHROPIC_API_KEY) {
          throw new LLMError(provider, 'CONFIG_ERROR', 'ANTHROPIC_API_KEY is required');
        }
        break;
        
      case LLMProvider.OPENAI:
        if (!config.OPENAI_API_KEY) {
          throw new LLMError(provider, 'CONFIG_ERROR', 'OPENAI_API_KEY is required');
        }
        break;
        
      case LLMProvider.OLLAMA:
        if (!config.OLLAMA_BASE_URL) {
          throw new LLMError(provider, 'CONFIG_ERROR', 'OLLAMA_BASE_URL is required');
        }
        break;
        
      default:
        throw new LLMError(provider, 'UNKNOWN_PROVIDER', `Unknown provider: ${provider}`);
    }
  }

  /**
   * Instantiate the appropriate provider service
   */
  private static instantiateProvider(provider: LLMProvider): LLMService {
    // Validate configuration first
    this.validateProviderConfiguration(provider);

    switch (provider) {
      case LLMProvider.GEMINI:
        return new GeminiService();

      case LLMProvider.OLLAMA:
        // Import dynamically to avoid issues if dependencies aren't installed
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { OllamaService } = require('./ollama-service');
          return new OllamaService();
        } catch (error) {
          throw new LLMUnavailableError(
            provider,
            'OllamaService not available. Run: npm install axios'
          );
        }

      case LLMProvider.ANTHROPIC:
        return new AnthropicService();

      case LLMProvider.OPENAI:
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { OpenAIService } = require('./openai-service');
          return new OpenAIService();
        } catch (error) {
          throw new LLMUnavailableError(
            provider,
            'OpenAIService not available. Run: npm install openai'
          );
        }

      default:
        throw new LLMError(provider, 'UNKNOWN_PROVIDER', `Unsupported provider: ${provider}`);
    }
  }

  /**
   * Health check for current provider
   */
  static async checkCurrentProviderHealth(): Promise<boolean> {
    if (!this.instance) {
      return false;
    }

    try {
      return await this.instance.isAvailable();
    } catch (error) {
      logger.warn('Provider health check failed', {
        provider: this.currentProvider,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Switch to a different provider (useful for failover scenarios)
   */
  static async switchProvider(newProvider: LLMProvider): Promise<LLMService> {
    logger.info('Switching LLM provider', {
      from: this.currentProvider,
      to: newProvider
    });

    const newService = this.instantiateProvider(newProvider);
    
    // Test if the new provider is available
    if (!await newService.isAvailable()) {
      throw new LLMUnavailableError(newProvider, 'Provider is not available');
    }

    // Switch to new provider
    this.instance = newService;
    this.currentProvider = newProvider;

    logger.info('Successfully switched LLM provider', {
      provider: newProvider,
      model: newService.model
    });

    return newService;
  }

  /**
   * Get provider capabilities
   */
  static getProviderCapabilities(provider: LLMProvider) {
    // Import capabilities from the types file
    const { PROVIDER_CAPABILITIES } = require('../types/llm');
    return PROVIDER_CAPABILITIES[provider];
  }
}