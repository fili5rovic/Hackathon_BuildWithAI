/**
 * Content script to highlight occurrences of multiple words on the page.
 */

(function () {
  // --- Configuration ---
  const wordsToHighlight = ["highlight", "test", "test"]; // List of words to highlight
  const highlightClass = "my-custom-highlight";
  // -------------------

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
    if (!words.length) return;

    // Prepare a regex that matches any of the words, case-insensitive
    const pattern = words.map(escapeRegExp).join("|");
    const regex = new RegExp(`(${pattern})`, "gi");

    // Use TreeWalker to efficiently find only relevant text nodes
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        // Reject nodes inside SCRIPT, STYLE, or already highlighted elements
        const parentTag = node.parentElement.tagName.toUpperCase();
        if (
          parentTag === "SCRIPT" ||
          parentTag === "STYLE" ||
          node.parentElement.closest(`.${cssClass}`)
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        if (regex.test(node.nodeValue)) {
          regex.lastIndex = 0;
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    });

    let node;
    const nodesToReplace = [];

    while ((node = walker.nextNode())) {
      nodesToReplace.push(node);
    }

    nodesToReplace.forEach((textNode) => {
      if (!textNode.parentNode) return;

      const text = textNode.nodeValue;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

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
        return match;
      });

      if (lastIndex < text.length) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex))
        );
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    });
    regex.lastIndex = 0;
  }
  /**
   * Extracts and returns all visible text content from the page.
   * Ignores SCRIPT, STYLE, NOSCRIPT, and hidden elements.
   * @returns {string} - All visible text concatenated.
   */
  function getAllVisibleText() {
    function isVisible(node) {
      // Exclude hidden elements
      return (
        node.nodeType === Node.TEXT_NODE &&
        node.parentElement &&
        node.nodeValue.trim().length > 0 &&
        !!(
          node.parentElement.offsetWidth ||
          node.parentElement.offsetHeight ||
          node.parentElement.getClientRects().length
        )
      );
    }
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          // Skip text inside SCRIPT, STYLE, NOSCRIPT, or hidden elements
          const tag = node.parentElement && node.parentElement.tagName;
          if (
            tag &&
            ["SCRIPT", "STYLE", "NOSCRIPT"].includes(tag.toUpperCase())
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return isVisible(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      }
    );
    let text = "";
    let node;
    while ((node = walker.nextNode())) {
      text += node.nodeValue + " ";
    }
    return text.trim();
  }

  // --- Execution ---
  if (document.body) {
    const allText = getAllVisibleText();
    console.log(allText);
    highlightWords(document.body, wordsToHighlight, highlightClass);
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      if (document.body) {
        const allText = getAllVisibleText();
        console.log(allText);
        highlightWords(document.body, wordsToHighlight, highlightClass);
      }
    });
  }
})();
