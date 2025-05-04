/**
 * Content script that sends page text to a backend, receives a list
 * of strings to highlight, and highlights them on the page.
 * Includes MutationObserver to handle Single-Page Applications (SPAs).
 */

(function () {
  // --- Configuration ---
  const backendUrl = "http://localhost:8080/gemini/ask-body";
  const highlightClass = "my-custom-highlight";
  const debounceWait = 1500; // Wait 1.5 seconds after DOM changes before re-highlighting
  // -------------------

  // --- Core Functions (escapeRegExp, highlightWords, getAllVisibleText, extractAndParseJson) ---
  // (Keep these functions exactly as they were in the previous version)

  /**
   * Escapes regex special characters in a string.
   * @param {string} str - The string to escape.
   * @returns {string} - The escaped string.
   */
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Traverses the DOM starting from rootNode and highlights text nodes containing any of the words.
   * @param {Node} rootNode - The starting node (e.g., document.body).
   * @param {string[]} words - Array of exact strings to highlight.
   * @param {string} cssClass - The CSS class to apply to the highlight.
   */
  function highlightWords(rootNode, words, cssClass) {
    // ... (function content remains the same) ...
    if (!words || !words.length) return;
    const validWords = words.filter(word => word && word.trim().length > 0);
    if (!validWords.length) return;
    const pattern = validWords.map(escapeRegExp).join("|");
    const regex = new RegExp(`(${pattern})`, "gi");
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        const parentElement = node.parentElement;
        if (!parentElement) return NodeFilter.FILTER_REJECT;
        const parentTag = parentElement.tagName.toUpperCase();
        if ( parentTag === "SCRIPT" || parentTag === "STYLE" || parentElement.closest(`.${cssClass}`) || parentElement.closest('[data-no-highlight]') ) {
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
        if (document.body.contains(node)) { nodesToProcess.push(node); }
    }
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
            if (offset > lastIndex) { fragment.appendChild( document.createTextNode(text.substring(lastIndex, offset)) ); }
            const mark = document.createElement("mark");
            mark.className = cssClass;
            mark.textContent = match;
            fragment.appendChild(mark);
            lastIndex = offset + match.length;
        }
        return match;
      });
      if (!matchFound) { return; }
      if (lastIndex < text.length) { fragment.appendChild( document.createTextNode(text.substring(lastIndex)) ); }
      if (textNode.parentNode) {
        try { textNode.parentNode.replaceChild(fragment, textNode); }
        catch (e) { console.error("[Highlighter] Error replacing text node:", e, textNode); }
      }
    });
    regex.lastIndex = 0;
  }

  /**
   * Extracts and returns visible text content from the page.
   * @returns {string} - Concatenated visible text.
   */
  function getAllVisibleText() {
    // ... (function content remains the same) ...
    const ignoredTags = ["SCRIPT", "STYLE", "NOSCRIPT", "HEAD", "META", "LINK", "TITLE", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "OPTION"];
    let textSegments = [];
    function isElementVisible(el) { if (!el) return false; const style = window.getComputedStyle(el); return style.display !== 'none' && style.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0); }
    const walker = document.createTreeWalker( document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          if (node.nodeType === Node.ELEMENT_NODE) { const element = node; const tagName = element.tagName.toUpperCase(); if (ignoredTags.includes(tagName) || !isElementVisible(element) || element.closest('[data-no-extract]')) { return NodeFilter.FILTER_REJECT; } return NodeFilter.FILTER_ACCEPT; }
          else if (node.nodeType === Node.TEXT_NODE) { const parentElement = node.parentElement; if (parentElement && !ignoredTags.includes(parentElement.tagName.toUpperCase()) && node.nodeValue.trim().length > 0 && isElementVisible(parentElement)) { return NodeFilter.FILTER_ACCEPT; } }
          return NodeFilter.FILTER_REJECT;
        },
      }
    );
    let currentNode;
    while (currentNode = walker.nextNode()) { if (currentNode.nodeType === Node.TEXT_NODE) { textSegments.push(currentNode.nodeValue.trim()); } }
    return textSegments.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Extracts JSON from a string, potentially removing markdown fences.
   * @param {string} rawText - The raw string response from the backend.
   * @returns {object | null} - The parsed JSON object or null if extraction/parsing fails.
   */
  function extractAndParseJson(rawText) {
    // ... (function content remains the same) ...
    if (!rawText || typeof rawText !== 'string') { console.error("[Highlighter] Invalid raw text received:", rawText); return null; }
    try {
        try { return JSON.parse(rawText); } catch (e) { /* Ignore */ }
        let jsonString = rawText.trim();
        if (jsonString.startsWith('```json')) { jsonString = jsonString.substring(7).trimStart(); }
        else if (jsonString.startsWith('```')) { jsonString = jsonString.substring(3).trimStart(); }
        if (jsonString.endsWith('```')) { jsonString = jsonString.substring(0, jsonString.length - 3).trimEnd(); }
        if (jsonString.startsWith('[') || jsonString.startsWith('{')) { /* console.log("[Highlighter] Attempting to parse extracted JSON string:", jsonString); */ return JSON.parse(jsonString); }
        else { console.error("[Highlighter] Extracted string doesn't look like JSON:", jsonString); return null; }
    } catch (error) { console.error("[Highlighter] Failed to parse JSON from backend response:", error); console.error("[Highlighter] Original raw text was:", rawText); return null; }
  }
  // ------------------------------------------------------------------------------------


  /**
   * Fetches hate speech data from the backend based on page text and initiates highlighting.
   */
  async function fetchAndHighlight() {
    console.log("[Highlighter] Running fetchAndHighlight..."); // Add log

    if (!document.body) {
      console.warn("[Highlighter] Document body not available yet.");
      return;
    }

    // --- Optional: Simple cleanup of previous highlights ---
    // This prevents highlights from accumulating if the observer triggers frequently
    // More robust cleanup might be needed depending on SPA behavior
    // document.querySelectorAll(`.${highlightClass}`).forEach(el => {
    //    // Replace mark with its text content - might need more sophisticated logic
    //    // if the original structure was complex.
    //    if (el.parentNode) {
    //       el.outerHTML = el.innerHTML;
    //    }
    // });
    // -----------------------------------------------------


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

      const rawResponseText = await response.text();
      // console.log("[Highlighter] Received raw response from backend:", rawResponseText); // Keep for debugging if needed

      const data = extractAndParseJson(rawResponseText);

      if (data === null) {
          return; // Stop execution if JSON is invalid
      }

      if (!Array.isArray(data)) {
          console.error("[Highlighter] Parsed data is not an array:", data);
          return;
      }

      const wordsToHighlight = data
        .map(item => item && typeof item === 'object' && item.text)
        .filter(text => typeof text === 'string' && text.trim().length > 0);

      if (wordsToHighlight.length > 0) {
        console.log("[Highlighter] Applying highlights for:", wordsToHighlight); // Add log
        highlightWords(document.body, wordsToHighlight, highlightClass);
      } else {
         console.log("[Highlighter] No strings to highlight based on parsed backend response."); // Add log
      }

    } catch (error) {
      console.error("[Highlighter] Error fetching or processing highlight data:", error);
      // Optional: Add more specific error logging if needed
    }
  }

  // --- Debounce Function ---
  function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
          console.log(`[Highlighter] Debounce triggered. Waiting ${wait}ms...`); // Add log
          const later = () => {
              clearTimeout(timeout);
              console.log("[Highlighter] Debounce timeout finished. Executing function."); // Add log
              func(...args);
          };
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
      };
  }

  // --- Execution Logic ---

  // 1. Create debounced version of the main function
  const debouncedFetchAndHighlight = debounce(fetchAndHighlight, debounceWait);

  // 2. Function to initialize everything (initial run + observer)
  function initializeHighlighter() {
      console.log("[Highlighter] Initializing..."); // Add log
      // Initial run
      debouncedFetchAndHighlight();

      // Setup MutationObserver
      const observerTarget = document.body;
      if (!observerTarget) {
          console.error("[Highlighter] Cannot find document.body to observe.");
          return;
      }

      const observerConfig = {
          childList: true, // Watch for addition/removal of child nodes
          subtree: true    // Watch the entire subtree under the target
          // Optional: attributes: false, characterData: false (usually not needed for SPA navigation)
      };

      const observer = new MutationObserver((mutationsList, obs) => {
          // We don't need to inspect mutationsList details usually,
          // just know that *something* changed.
          console.log("[Highlighter] MutationObserver detected DOM change."); // Add log
          // Call the debounced function whenever a mutation occurs
          debouncedFetchAndHighlight();
      });

      // Start observing
      observer.observe(observerTarget, observerConfig);
      console.log("[Highlighter] MutationObserver started observing document.body."); // Add log

      // Optional: Disconnect observer when the window unloads (good practice)
      // window.addEventListener('unload', () => {
      //    observer.disconnect();
      //    console.log("[Highlighter] MutationObserver disconnected.");
      // });
  }

  // 3. Run initialization when the DOM is ready
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initializeHighlighter);
  } else {
    // DOM is already ready
    initializeHighlighter();
  }

})();