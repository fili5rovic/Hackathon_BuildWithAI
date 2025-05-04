/**
 * Content script that sends page text to a backend, receives a list
 * of strings to highlight, and highlights them on the page.
 * Handles backend responses that might be strings containing JSON,
 * potentially wrapped in markdown code fences.
 */

(function () {
  // --- Configuration ---
  const backendUrl = "http://localhost:8080/gemini/ask-body"; // Your backend endpoint
  const highlightClass = "my-custom-highlight"; // CSS class for highlighting
  // -------------------

  // ... (escapeRegExp, highlightWords, getAllVisibleText functions remain the same) ...

   /**
   * Escapes regex special characters in a string.
   * @param {string} str - The string to escape.
   * @returns {string} - The escaped string.
   */
   function escapeRegExp(str) {
    // Escape characters carefully, especially those that might appear in various languages
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Traverses the DOM starting from rootNode and highlights text nodes containing any of the words.
   * Uses TreeWalker for efficient and safe DOM traversal.
   * Handles potentially overlapping matches and complex node structures.
   * @param {Node} rootNode - The starting node (e.g., document.body).
   * @param {string[]} words - Array of exact strings to highlight.
   * @param {string} cssClass - The CSS class to apply to the highlight.
   */
  function highlightWords(rootNode, words, cssClass) {
    if (!words || !words.length) {
        // console.log("[Highlighter] No words provided for highlighting.");
        return;
    }

    const validWords = words.filter(word => word && word.trim().length > 0);
    if (!validWords.length) {
        // console.log("[Highlighter] No valid words provided for highlighting after filtering.");
        return;
    }

    const pattern = validWords.map(escapeRegExp).join("|");
    // Using 'g' for global match, 'i' for case-insensitive.
    const regex = new RegExp(`(${pattern})`, "gi");
    // console.log("[Highlighter] Regex:", regex); // Uncomment for debugging

    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        const parentElement = node.parentElement;
        if (!parentElement) return NodeFilter.FILTER_REJECT;
        const parentTag = parentElement.tagName.toUpperCase();
        if (
          parentTag === "SCRIPT" ||
          parentTag === "STYLE" ||
          parentElement.closest(`.${cssClass}`) ||
          parentElement.closest('[data-no-highlight]')
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        regex.lastIndex = 0;
        if (regex.test(node.nodeValue)) {
          regex.lastIndex = 0;
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    });

    let node;
    const nodesToProcess = [];
    while ((node = walker.nextNode())) {
        if (document.body.contains(node)) {
            nodesToProcess.push(node);
        }
    }

    // console.log(`[Highlighter] Found ${nodesToProcess.length} text nodes potentially containing text to highlight.`);

    nodesToProcess.forEach((textNode) => {
      if (!textNode.parentNode) return;

      const text = textNode.nodeValue;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let matchFound = false;

      text.replace(regex, (match, p1, offset) => {
        const lowerCaseMatch = match.toLowerCase();
        const shouldHighlight = validWords.some(validWord => validWord.toLowerCase() === lowerCaseMatch);

        if (shouldHighlight) {
            matchFound = true;
            if (offset > lastIndex) {
              fragment.appendChild(
                document.createTextNode(text.substring(lastIndex, offset))
              );
            }
            const mark = document.createElement("mark");
            mark.className = cssClass;
            mark.textContent = match;
            fragment.appendChild(mark);
            lastIndex = offset + match.length;
        }
        return match;
      });

      if (!matchFound) {
          return;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex))
        );
      }

      if (textNode.parentNode) {
        try {
          textNode.parentNode.replaceChild(fragment, textNode);
        } catch (e) {
          console.error("[Highlighter] Error replacing text node:", e, textNode);
        }
      } else {
        // console.warn("[Highlighter] Text node parent disappeared before replacement:", textNode); // Uncomment for debugging
      }
    });

    regex.lastIndex = 0;
  }

  /**
   * Extracts and returns visible text content from the page, suitable for sending to backend.
   * @returns {string} - Concatenated visible text.
   */
  function getAllVisibleText() {
    const ignoredTags = ["SCRIPT", "STYLE", "NOSCRIPT", "HEAD", "META", "LINK", "TITLE", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "OPTION"];
    let textSegments = [];

    function isElementVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
    }

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            const tagName = element.tagName.toUpperCase();
            if (ignoredTags.includes(tagName) || !isElementVisible(element) || element.closest('[data-no-extract]')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          } else if (node.nodeType === Node.TEXT_NODE) {
            const parentElement = node.parentElement;
            if (parentElement && !ignoredTags.includes(parentElement.tagName.toUpperCase()) && node.nodeValue.trim().length > 0 && isElementVisible(parentElement)) {
              return NodeFilter.FILTER_ACCEPT;
            }
          }
          return NodeFilter.FILTER_REJECT;
        },
      }
    );

    let currentNode;
    while (currentNode = walker.nextNode()) {
      if (currentNode.nodeType === Node.TEXT_NODE) {
        textSegments.push(currentNode.nodeValue.trim());
      }
    }
    return textSegments.join(' ').replace(/\s+/g, ' ').trim();
  }


  /**
   * Extracts JSON from a string, potentially removing markdown fences.
   * @param {string} rawText - The raw string response from the backend.
   * @returns {object | null} - The parsed JSON object or null if extraction/parsing fails.
   */
  function extractAndParseJson(rawText) {
      if (!rawText || typeof rawText !== 'string') {
          console.error("[Highlighter] Invalid raw text received:", rawText);
          return null;
      }

      try {
          // Attempt 1: Try direct parsing (if it's already valid JSON)
          try {
              return JSON.parse(rawText);
          } catch (e) {
              // Ignore direct parsing error and proceed to extraction
          }

          // Attempt 2: Remove potential markdown fences and then parse
          let jsonString = rawText.trim();
          // Remove ```json prefix (allowing for optional space)
          if (jsonString.startsWith('```json')) {
              jsonString = jsonString.substring(7).trimStart();
          } else if (jsonString.startsWith('```')) {
              // Handle case where language is not specified, e.g., just ```
              jsonString = jsonString.substring(3).trimStart();
          }

          // Remove ``` suffix
          if (jsonString.endsWith('```')) {
              jsonString = jsonString.substring(0, jsonString.length - 3).trimEnd();
          }

          // Final check: Ensure it looks like JSON (starts with [ or {)
          if (jsonString.startsWith('[') || jsonString.startsWith('{')) {
            console.log("[Highlighter] Attempting to parse extracted JSON string:", jsonString);
            return JSON.parse(jsonString);
          } else {
            console.error("[Highlighter] Extracted string doesn't look like JSON:", jsonString);
            return null;
          }

      } catch (error) {
          console.error("[Highlighter] Failed to parse JSON from backend response:", error);
          console.error("[Highlighter] Original raw text was:", rawText); // Log the original text for debugging
          return null;
      }
  }

  /**
   * Fetches hate speech data from the backend based on page text and initiates highlighting.
   */
  async function fetchAndHighlight() {
    // await new Promise(resolve => setTimeout(resolve, 500)); // Optional delay

    if (!document.body) {
      console.warn("[Highlighter] Document body not available yet.");
      return;
    }

    try {
      const pageText = getAllVisibleText();
      if (!pageText) {
          console.log("[Highlighter] No visible text extracted from the page.");
          return;
      }

      const requestBody = { prompt: pageText };

      const response = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorBody = 'Could not read error body';
        try { errorBody = await response.text(); } catch (e) {/* Ignore */}
        throw new Error(`Backend request failed: ${response.status} ${response.statusText}. Body: ${errorBody}`);
      }

      // --- MODIFICATION START ---
      // Get the raw text response instead of trying to parse JSON directly
      const rawResponseText = await response.text();
      console.log("[Highlighter] Received raw response from backend:", rawResponseText);

      // Extract and parse the JSON from the raw text
      const data = extractAndParseJson(rawResponseText);

      // Check if parsing was successful
      if (data === null) {
          // Error already logged in extractAndParseJson
          return; // Stop execution if JSON is invalid
      }
      // --- MODIFICATION END ---


      // --- Continue with the parsed data ---
      if (!Array.isArray(data)) {
          console.error("[Highlighter] Parsed data is not an array:", data);
          return;
      }

      const wordsToHighlight = data
        .map(item => item && typeof item === 'object' && item.text)
        .filter(text => typeof text === 'string' && text.trim().length > 0);

      if (wordsToHighlight.length > 0) {
        highlightWords(document.body, wordsToHighlight, highlightClass);
      } else {
        // console.log("[Highlighter] No strings to highlight based on parsed backend response.");
      }

    } catch (error) {
      console.error("[Highlighter] Error fetching or processing highlight data:", error);
      if (error.message?.includes("Failed to fetch") && error.name === "TypeError") {
          console.warn("[Highlighter] This 'Failed to fetch' error might be CORS-related. Ensure backend at " + backendUrl + " has correct CORS headers.");
      }
    }
  }

  // --- Execution ---
  function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
          const later = () => {
              clearTimeout(timeout);
              func(...args);
          };
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
      };
  }

  const debouncedFetchAndHighlight = debounce(fetchAndHighlight, 1000);

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", debouncedFetchAndHighlight);
  } else {
    debouncedFetchAndHighlight();
  }

})();