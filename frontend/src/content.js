/**
 * Simple content script to highlight occurrences of a specific word on the page.
 */

(function () {
  // --- Configuration ---
  const wordToHighlight = "highlight"; // Change this word if needed
  const highlightClass = "my-custom-highlight";
  // -------------------

  /**
   * Traverses the DOM starting from rootNode and highlights text nodes containing the word.
   * Uses TreeWalker for efficient and safe DOM traversal.
   * @param {Node} rootNode - The starting node (e.g., document.body).
   * @param {string} word - The word to highlight.
   * @param {string} cssClass - The CSS class to apply to the highlight.
   */
  function highlightWords(rootNode, word, cssClass) {
    const regex = new RegExp(`(${word})`, "gi"); // 'g' for global, 'i' for case-insensitive

    // Use TreeWalker to efficiently find only relevant text nodes
    const walker = document.createTreeWalker(
      rootNode,
      NodeFilter.SHOW_TEXT, // Only consider text nodes
      {
        acceptNode: function (node) {
          // Reject nodes inside SCRIPT, STYLE, or already highlighted elements
          const parentTag = node.parentElement.tagName.toUpperCase();
          if (
            parentTag === "SCRIPT" ||
            parentTag === "STYLE" ||
            node.parentElement.closest(`.${cssClass}`)
          ) {
            // Check parentage for highlight class
            return NodeFilter.FILTER_REJECT;
          }
          // Check if the text content contains the word (case-insensitive)
          if (regex.test(node.nodeValue)) {
            // Reset regex lastIndex before testing again if needed in complex scenarios
            regex.lastIndex = 0;
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        },
      }
      // false // Deprecated fourth argument
    );

    let node;
    const nodesToReplace = []; // Collect nodes to modify after traversal

    // First traversal: find all nodes that need changes
    while ((node = walker.nextNode())) {
      nodesToReplace.push(node);
    }

    // Second pass: Modify the DOM safely after traversal is complete
    nodesToReplace.forEach((textNode) => {
      // Check if node still exists and has a parent (it might have been removed by other JS)
      if (!textNode.parentNode) return;

      const text = textNode.nodeValue;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      // Use replace with a function to handle matches and create nodes
      text.replace(regex, (match, p1, offset) => {
        // Add text segment before the match
        if (offset > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.substring(lastIndex, offset))
          );
        }
        // Create the highlighted element (using <mark> is semantic)
        const mark = document.createElement("mark");
        mark.className = cssClass;
        mark.textContent = match; // Use the original matched text casing
        fragment.appendChild(mark);
        lastIndex = offset + match.length;

        // The return value of the replace function isn't used here
        return match; // Standard practice to return the match
      });

      // Add any remaining text after the last match
      if (lastIndex < text.length) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex))
        );
      }

      // Replace the original text node with the fragment containing highlighted parts
      textNode.parentNode.replaceChild(fragment, textNode);
    });
    // Reset regex state just in case it's used elsewhere (good practice)
    regex.lastIndex = 0;
  }

  // --- Execution ---
  // Run the highlighter on the main body of the document
  // Check if body exists before running
  if (document.body) {
    highlightWords(document.body, wordToHighlight, highlightClass);
  } else {
    // If body isn't ready yet, wait for DOMContentLoaded
    // Note: run_at: document_idle usually makes this unnecessary
    window.addEventListener("DOMContentLoaded", () => {
      if (document.body) {
        highlightWords(document.body, wordToHighlight, highlightClass);
      }
    });
  }
})(); // IIFE to avoid polluting global scope
