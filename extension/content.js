chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "post_to_linkedin") {
    // 1. Find the "Start a post" button
    let postButton = document.querySelector(".share-box-feed-entry__trigger") || 
                     document.querySelector("button.artdeco-button--tertiary");
    
    if (postButton) {
      postButton.click();
      
      // 2. Wait a second for the modal to open, then find the text area
      setTimeout(() => {
        let editor = document.querySelector(".ql-editor");
        if (editor) {
          editor.innerHTML = `<p>${request.text}</p>`;
          sendResponse({status: "Drafted! User must click Post."});
        }
      }, 1000);
    }
  }
  return true;
});