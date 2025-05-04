import { Component, NgZone, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-root', // This selector needs to match the element Angular bootstraps onto (e.g., <app-root> or the ID used if bootstrapping directly to the injected div)
  template: `
    <div
      style="border: 2px solid blue; padding: 10px; background: white; color: black; position: fixed; top: 10px; right: 10px; z-index: 10000; max-width: 300px; max-height: 400px; overflow: auto;"
    >
      <h2>Extracted Text (Extension)</h2>
      <pre style="white-space: pre-wrap; word-wrap: break-word;">{{
        pageText
      }}</pre>
      <p>
        <i>Listener Status: {{ listenerStatus }}</i>
      </p>
    </div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  pageText = 'Waiting for text...';
  listenerStatus = 'Inactive';
  private readonly EXPECTED_MESSAGE_TYPE = 'FROM_CONTENT_SCRIPT_TEXT_READY'; // Match content script

  // Store listener function reference for removal
  private messageListener = (event: MessageEvent) => {
    // Log ALL received messages first for debugging
    console.log(
      'AppComponent: messageListener FUNCTION EXECUTED! Origin:',
      event.origin,
      'Data Type:',
      typeof event.data,
      'Data:',
      event.data
    );

    // --- Security Check 1: Origin ---
    // Only accept messages from the same origin
    // NOTE: In some complex scenarios (like sandboxed iframes), the origin might differ.
    // Be cautious if you need to relax this check.
    if (event.origin !== window.location.origin) {
      console.warn(
        `AppComponent: Message rejected. Origin mismatch. Expected: ${window.location.origin}, Received: ${event.origin}`
      );
      this.setListenerStatus(`Rejected message from origin: ${event.origin}`);
      return;
    }

    // --- Security Check 2: Source (Optional but recommended) ---
    // Ensure the message came from the current window, not an iframe within it
    if (event.source !== window) {
      console.warn(
        'AppComponent: Message rejected. Source is not the current window.'
      );
      this.setListenerStatus('Rejected message from non-window source');
      return;
    }

    // --- Data Check ---
    // Check if the message structure/type matches what we expect
    if (
      event.data &&
      typeof event.data === 'object' &&
      event.data.type === this.EXPECTED_MESSAGE_TYPE
    ) {
      this.setListenerStatus('Processing valid message...');
      // Use NgZone to ensure Angular detects the change when updating the model
      this.ngZone.run(() => {
        console.log(
          'AppComponent: Valid message received, updating text. Length:',
          event.data.text?.length ?? 0
        );
        this.pageText = event.data.text || '[No text received in message]'; // Handle empty text case
        this.setListenerStatus(
          `Text updated at ${new Date().toLocaleTimeString()}`
        );
      });
    } else {
      // Log if data exists but type doesn't match or structure is wrong
      if (event.data && event.data.type) {
        console.log(
          `AppComponent: Received message with known data structure but wrong type: ${event.data.type}`
        );
        this.setListenerStatus(`Ignoring message type: ${event.data.type}`);
      } else {
        // Log other messages (could be from other extensions or the page itself)
        console.log(
          'AppComponent: Received irrelevant message (unexpected data structure or type).'
        );
        // Avoid flooding status with irrelevant messages unless debugging
        // this.setListenerStatus('Ignoring irrelevant message');
      }
    }
  };

  constructor(private ngZone: NgZone) {
    console.log('AppComponent: Constructor called.');
  }

  ngOnInit() {
    console.log('AppComponent: ngOnInit - Adding message listener.'); // Log before adding
    window.addEventListener('message', this.messageListener, false);
    console.log('AppComponent: ngOnInit - Listener ADDED.'); // Log after adding
    this.setListenerStatus('Active - Listening for messages');
  }

  ngOnDestroy() {
    console.log('AppComponent: ngOnDestroy - Removing message listener.'); // Log before removing
    window.removeEventListener('message', this.messageListener, false);
    console.log('AppComponent: ngOnDestroy - Listener REMOVED.'); // Log after removing
    this.setListenerStatus('Inactive - Destroyed');
  }

  // Helper to update status and log
  private setListenerStatus(status: string) {
    // Run inside NgZone if the status update needs to reflect immediately in the template
    this.ngZone.run(() => {
      this.listenerStatus = status;
      console.log(`AppComponent Status: ${status}`);
    });
  }
}
