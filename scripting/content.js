/**
 * Content script to highlight occurrences of multiple words on the page
 * and send extracted text to the page context.
 */

(function () {
  // --- Configuration ---
  const wordsToHighlight = ["highlight", "test", "test"]; // List of words to highlight
  const highlightClass = "my-custom-highlight";
  const MESSAGE_TYPE = "FROM_CONTENT_SCRIPT_TEXT_READY"; // Define type constant
  // -------------------

  console.log("Content Script Loaded"); // Log script load

  /**
   * Escapes regex special characters in a string.
   * @param {string} str
   * @returns {string}
   */
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Traverses the DOM starting from rootNode and highlights text nodes containing any of the words.
   * Uses TreeWalker for efficient and safe DOM traversal.
   * @param {Node} rootNode - The starting node (e.g., document.body).
   * @param {string[]} words - Array of words to highlight.
   * @param {string} cssClass - The CSS class to apply to the highlight.
   */
  function highlightWords(rootNode, words, cssClass) {
    if (!words.length || !rootNode) return;

    // Prepare a regex that matches any of the words, case-insensitive
    const pattern = words.map(escapeRegExp).join("|");
    const regex = new RegExp(`(${pattern})`, "gi");

    // Use TreeWalker to efficiently find only relevant text nodes
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        // Reject nodes inside SCRIPT, STYLE, or already highlighted elements
        const parentTag = node.parentElement?.tagName.toUpperCase();
        if (
          parentTag === "SCRIPT" ||
          parentTag === "STYLE" ||
          node.parentElement?.closest(`.${cssClass}`)
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        // Reset regex state before testing
        regex.lastIndex = 0;
        if (node.nodeValue && regex.test(node.nodeValue)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    });

    let node;
    const nodesToReplace = [];

    while ((node = walker.nextNode())) {
      // Check if the node is still part of the document
      if (document.body.contains(node)) {
        nodesToReplace.push(node);
      }
    }

    nodesToReplace.forEach((textNode) => {
      // Double-check parentNode existence before proceeding
      if (!textNode.parentNode) return;

      const text = textNode.nodeValue;
      if (!text) return; // Skip if nodeValue is null/empty

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      // Reset regex state before replacing
      regex.lastIndex = 0;
      text.replace(regex, (match, p1, offset) => {
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
        return match; // Required by replace function signature
      });

      if (lastIndex < text.length) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex))
        );
      }

      // Ensure the parent still exists and contains the textNode before replacing
      if (textNode.parentNode) {
        try {
          textNode.parentNode.replaceChild(fragment, textNode);
        } catch (e) {
          // This can happen if the node was removed by something else in the meantime
          console.warn(
            "Content Script: Failed to replace node during highlighting.",
            e
          );
        }
      }
    });
    // Reset regex state after all replacements
    regex.lastIndex = 0;
  }

  /**
   * Extracts and returns all visible text content from the page.
   * Ignores SCRIPT, STYLE, NOSCRIPT, and hidden elements.
   * @returns {string} - All visible text concatenated.
   */
  function getAllVisibleText() {
    function isVisible(node) {
      // Check if node is a text node and has content
      if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue?.trim()) {
        return false;
      }
      const parentElement = node.parentElement;
      if (!parentElement) return false;

      // Check if the element or its ancestors are hidden
      if (
        parentElement.closest(
          '[hidden], [style*="display: none"], [style*="visibility: hidden"]'
        )
      ) {
        return false;
      }

      // Check computed style (more reliable but potentially slower)
      try {
        const style = window.getComputedStyle(parentElement);
        if (style.display === "none" || style.visibility === "hidden") {
          return false;
        }
      } catch (e) {
        // Getting computed style can fail in some edge cases (e.g., detached nodes)
        console.warn(
          "Content Script: Could not get computed style for node parent.",
          e
        );
        return false;
      }

      // Check dimensions (basic visibility check)
      return !!(
        parentElement.offsetWidth ||
        parentElement.offsetHeight ||
        parentElement.getClientRects().length
      );
    }

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, // Check elements too for style computation
      {
        acceptNode: function (node) {
          // Skip SCRIPT, STYLE, NOSCRIPT elements and their descendants entirely
          const parentElement =
            node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
          const tag = parentElement?.tagName?.toUpperCase();
          if (tag && ["SCRIPT", "STYLE", "NOSCRIPT"].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          // For text nodes, perform the visibility check
          if (node.nodeType === Node.TEXT_NODE) {
            return isVisible(node)
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          }
          // For element nodes, just skip them, we only want text nodes
          return NodeFilter.FILTER_SKIP;
        },
      }
    );
    let text = "";
    let node;
    while ((node = walker.nextNode())) {
      // Append text content, ensuring it's trimmed and adding a space
      const nodeText = node.nodeValue?.trim(); // Added null check
      if (nodeText) {
        text += nodeText + " ";
      }
    }
    // Trim the final result to remove trailing space
    const extractedText = text.trim();
    console.log("Content Script: Extracted Text Length:", extractedText.length); // Log extracted text length
    return extractedText;
  }

  /**
   * Sends the extracted text to the page's main world using window.postMessage.
   * @param {string} textData - The text data to send.
   */
  function sendTextToPageViaPostMessage(textData) {
    // Ensure MESSAGE_TYPE is defined before this point
    if (typeof MESSAGE_TYPE === "undefined") {
      console.error(
        "Content Script: FATAL - MESSAGE_TYPE is not defined before use in sendTextToPageViaPostMessage!"
      );
      return; // Prevent further errors
    }
    const messagePayload = {
      type: MESSAGE_TYPE, // Now this should work
      text: textData,
    };
    const targetOrigin = window.location.origin;
    console.log(
      `Content Script: Posting message to window. Type: ${MESSAGE_TYPE}, Target Origin: ${targetOrigin}, Payload Length: ${
        textData?.length ?? 0
      }`
    );
    try {
      window.postMessage(messagePayload, targetOrigin);
      console.log("Content Script: Message posted successfully.");
    } catch (error) {
      console.error("Content Script: Error posting message:", error);
    }
  }

  /**
   * Example function to inject Angular app container and scripts.
   * Requires built Angular files and manifest configuration.
   */
  function injectAngularApp() {
    console.log(
      "Content Script: Injecting Angular container and scripts (Example)..."
    );

    // Check if already injected
    if (document.getElementById("my-extension-angular-root")) {
      console.log("Content Script: Angular container already exists.");
      return;
    }

    // 1. Create a container element for the Angular app
    const appContainer = document.createElement("div");
    appContainer.id = "my-extension-angular-root"; // Unique ID
    document.body.appendChild(appContainer);
    console.log("Content Script: Angular container injected.");

    // 2. Inject the Angular runtime, polyfills, main bundle scripts
    //    These filenames are examples and depend on your build output.
    //    Ensure these files are listed in manifest.json -> web_accessible_resources
    const scriptUrls = [
      "angular_build/runtime.js",
      "angular_build/polyfills.js",
      "angular_build/main.js",
    ];

    scriptUrls.forEach((relativePath) => {
      try {
        const url = chrome.runtime.getURL(relativePath);
        const script = document.createElement("script");
        script.src = url;
        // Use 'module' if your Angular build outputs ES modules, otherwise remove type.
        // script.type = 'module';
        script.defer = true; // Defer execution until DOM is parsed
        (document.head || document.documentElement).appendChild(script);
        console.log(`Content Script: Injected script ${url}`);
      } catch (e) {
        console.error(
          `Content Script: Failed to get URL or inject script for ${relativePath}. Is it in web_accessible_resources?`,
          e
        );
      }
    });

    // Optionally inject CSS (adjust path as needed)
    try {
      const cssUrl = chrome.runtime.getURL("angular_build/styles.css");
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssUrl;
      (document.head || document.documentElement).appendChild(link);
      console.log(`Content Script: Injected CSS ${cssUrl}`);
    } catch (e) {
      console.error(
        "Content Script: Failed to get URL or inject styles.css. Is it in web_accessible_resources?",
        e
      );
    }
  }

  // --- Execution ---
  function runExtractionAndHighlighting() {
    console.log("Content Script: runExtractionAndHighlighting called.");
    if (!document.body) {
      console.log("Content Script: document.body not ready yet.");
      return;
    }

    try {
      const allText = getAllVisibleText();
      if (allText) {
        sendTextToPageViaPostMessage(allText);
      } else {
        console.log("Content Script: No visible text found to send.");
      }

      highlightWords(document.body, wordsToHighlight, highlightClass);
      console.log("Content Script: Highlighting complete.");

      // Call the injection function (if using Strategy 1)
      injectAngularApp();
    } catch (error) {
      console.error("Content Script: Error during execution:", error);
    }
  }

  // Wait for the DOM to be ready (using document_idle in manifest is often better)
  if (document.readyState === "loading") {
    console.log(
      "Content Script: DOM loading, adding DOMContentLoaded listener."
    );
    window.addEventListener("DOMContentLoaded", runExtractionAndHighlighting);
  } else {
    console.log("Content Script: DOM already ready, running now.");
    runExtractionAndHighlighting();
  }
})();
