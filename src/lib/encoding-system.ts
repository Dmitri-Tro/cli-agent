/**
 * System-wide Encoding Handler for Cyrillic and other character sets
 * Replaces pattern-based patching with proper encoding detection and conversion
 */

import * as iconv from 'iconv-lite';

export interface EncodingDetectionResult {
  encoding: string;
  confidence: number;
  originalText: string;
  convertedText: string;
}

export class EncodingSystem {
  // Common problematic encodings that we encounter
  private static readonly PROBLEMATIC_PATTERNS = [
    /[ðÐñþÃÊÇÝ×ºñ°üé╗░▓▒│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀]/,
  ];

  /**
   * Detect if text contains encoding issues
   */
  public static hasEncodingIssues(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    
    return this.PROBLEMATIC_PATTERNS.some(pattern => pattern.test(text));
  }

  /**
   * Convert text from detected problematic encoding to UTF-8
   */
  public static fixEncoding(text: string): string {
    if (!text || typeof text !== 'string') return text;
    
    // If no encoding issues detected, return as-is
    if (!this.hasEncodingIssues(text)) {
      return text;
    }

    try {
      // Simple, direct approach - just try basic encoding fix
      return this.basicEncodingFix(text);
      
    } catch {
      // Silently fall back to original text
      return text;
    }
  }



  /**
   * Check if text contains valid Cyrillic characters
   */
  private static isValidCyrillicText(text: string): boolean {
    // Check for valid Cyrillic range
    const cyrillicRegex = /[а-яё]/i;
    
    // Should contain some Cyrillic and not contain problematic symbols
    return cyrillicRegex.test(text) && !this.hasEncodingIssues(text);
  }

  /**
   * Basic encoding detection and conversion
   */
  private static basicEncodingFix(text: string): string {
    if (!text || typeof text !== 'string') return text;
    
    // If text appears valid, don't process it
    if (!this.hasEncodingIssues(text)) {
      return text;
    }

    // Try basic CP1251 conversion for corrupted Cyrillic
    try {
      const buffer = Buffer.from(text, 'binary');
      const converted = iconv.decode(buffer, 'cp1251');
      
      // If conversion resulted in valid Cyrillic, use it
      if (this.isValidCyrillicText(converted)) {
        return converted;
      }
    } catch {
      // Fall back to original text if conversion fails
    }

    return text;
  }

  /**
   * Fix encoding for error objects
   */
  public static fixErrorEncoding(error: unknown): string {
    if (!error) return '';
    
    let message = '';
    if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String((error as { message: unknown }).message);
    } else {
      message = String(error);
    }
    
    return this.fixEncoding(message);
  }

  /**
   * Fix encoding for user messages and suggestions
   */
  public static fixUserMessage(userMessage: string, suggestions?: string[]): {
    userMessage: string;
    suggestions: string[];
  } {
    const fixedUserMessage = this.fixEncoding(userMessage);
    const fixedSuggestions = suggestions?.map(s => this.fixEncoding(s)) ?? [];
    
    return {
      userMessage: fixedUserMessage,
      suggestions: fixedSuggestions,
    };
  }

  /**
   * Ensure proper console output encoding
   */
  public static setupConsoleEncoding(): void {
    try {
      // Set UTF-8 encoding for stdout/stderr
      if (process.stdout.setEncoding) {
        process.stdout.setEncoding('utf8');
      }
      if (process.stderr.setEncoding) {
        process.stderr.setEncoding('utf8');
      }

      // Set environment variables for proper encoding
      process.env.CHCP = '65001'; // UTF-8 for Windows
      process.env.LANG = 'ru_RU.UTF-8';
      
    } catch (error) {
      console.warn('Failed to setup console encoding:', error);
    }
  }
}
