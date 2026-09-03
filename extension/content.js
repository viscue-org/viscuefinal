(() => {
  const entryId='viscue-composer-entry';
  const adapters={
    ChatGPT:{composer:['#prompt-textarea','textarea[data-testid="prompt-textarea"]','div[contenteditable="true"]'],file:['input[type="file"]'],send:['button[data-testid="send-button"]','button[aria-label*="Send"]']},
    Gemini:{composer:['rich-textarea div[contenteditable="true"]','div.ql-editor[contenteditable="true"]'],file:['input[type="file"]'],send:['button[aria-label*="Send message"]','button[aria-label*="Send"]']},
    Claude:{composer:['div.ProseMirror[contenteditable="true"]','div[contenteditable="true"]'],file:['input[type="file"]'],send:['button[aria-label*="Send"]','button[data-testid*="send"]']},
    Copilot:{composer:['textarea','#userInput','div[contenteditable="true"]'],file:['input[type="file"]'],send:['button[aria-label*="Submit"]','button[aria-label*="Send"]']},
    Perplexity:{composer:['textarea','div[contenteditable="true"]'],file:['input[type="file"]'],send:['button[aria-label*="Submit"]','button[aria-label*="Send"]']},
    Grok:{composer:['textarea','div[contenteditable="true"]'],file:['input[type="file"]'],send:['button[aria-label*="Submit"]','button[aria-label*="Send"]']}
  };
  const platform=location.hostname.includes('gemini.google')?'Gemini':location.hostname.includes('claude.ai')?'Claude':location.hostname.includes('copilot.microsoft')?'Copilot':location.hostname.includes('perplexity')?'Perplexity':location.hostname.includes('grok.com')?'Grok':'ChatGPT';
  const adapter=adapters[platform];

  function queryFirst(selectors){for(const selector of selectors){const element=document.querySelector(selector);if(element)return element}return null}
  function addEntry(){if(document.getElementById(entryId))return;const composer=queryFirst(adapter.composer);if(!composer)return;const button=document.createElement('button');button.id=entryId;button.type='button';button.textContent='Open Viscue';button.title='Open the Viscue visual intent workspace';button.addEventListener('click',()=>chrome.runtime.sendMessage({type:'open-workspace'}));const parent=composer.closest('form')||composer.parentElement;parent?.append(button)}
  addEntry();new MutationObserver(addEntry).observe(document.documentElement,{childList:true,subtree:true});

  chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
    if(message.type==='insert-prompt'){insertPrompt(message.prompt).then(ok=>sendResponse(ok?{ok:true}:{ok:false,error:'Destination composer was not found.'}));return true}
    if(message.type==='handoff'){runHandoff(message).then(sendResponse).catch(error=>sendResponse({ok:false,error:error.message}));return true}
  });

  async function runHandoff({prompt,attachments=[],submit=false,executionId,destinationFingerprint,promptHash}){
    const actualDestination=`${platform}:${location.pathname}`;
    if(destinationFingerprint!==actualDestination)throw new Error('The destination conversation changed after compilation. Nothing was attached or submitted.');
    if(await sha256(prompt)!==promptHash)throw new Error('The compiled prompt hash does not match this handoff. Nothing was attached or submitted.');
    const composer=await waitFor(()=>queryFirst(adapter.composer),8000,'Destination composer was not found.');
    let attached=0;
    if(attachments.length){
      const files=await Promise.all(attachments.map(toFile));
      const input=queryFirst(adapter.file);
      if(input){attached=attachThroughInput(input,files)}
      if(attached!==files.length){const pasted=dispatchFilePaste(composer,files);if(pasted)attached=files.length}
      if(attached!==files.length)throw new Error(`${platform} did not accept all ${files.length} references automatically. Reopen the composer and try Send intent again.`)
      await waitForAttachmentsReady(files);
      console.info('[Viscue handoff] references ready',{platform,count:files.length});
    }
    await insertAndVerifyPrompt(composer,prompt);
    console.info('[Viscue handoff] prompt verified',{platform,characters:prompt.length});
    const confirmedAttachments=attachments.map(item=>({...item,confirmed:true}));
    if(!submit)return{ok:true,attached,...globalThis.ViscueHandoff.buildReceipt({executionId,destinationFingerprint,promptHash,attachments:confirmedAttachments,promptVerified:true,submitted:false})};
    const sendButton=await waitFor(()=>{const button=queryFirst(adapter.send);return button&&!button.disabled?button:null},15000,'The destination Send button did not become ready.');
    if(!composerContainsPrompt(composer,prompt))throw new Error('The destination editor lost the instruction before submission. Nothing was sent.');
    sendButton.click();console.info('[Viscue handoff] submit clicked',{platform});return{ok:true,attached,...globalThis.ViscueHandoff.buildReceipt({executionId,destinationFingerprint,promptHash,attachments:confirmedAttachments,promptVerified:true,submitted:true})};
  }
  async function insertPrompt(prompt){const composer=queryFirst(adapter.composer);if(!composer)return false;await insertAndVerifyPrompt(composer,prompt);return true}
  async function insertAndVerifyPrompt(composer,text){
    const attempts=[insertWithNativeEditor,insertWithBeforeInput,insertWithDomFallback];
    for(const attempt of attempts){
      attempt(composer,text);
      try{await waitForStablePrompt(composer,text,1800);return true}catch{}
    }
    throw new Error(`${platform} did not accept the compiled instruction. The references remain attached, but Viscue did not submit an image-only message.`)
  }
  function insertWithNativeEditor(composer,text){
    composer.focus();
    if(composer instanceof HTMLTextAreaElement||composer instanceof HTMLInputElement){
      const proto=composer instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto,'value')?.set?.call(composer,text);
      composer.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));
      composer.dispatchEvent(new Event('change',{bubbles:true}));return;
    }
    const selection=getSelection(),range=document.createRange();range.selectNodeContents(composer);selection?.removeAllRanges();selection?.addRange(range);
    const inserted=document.execCommand?.('insertText',false,text);
    if(!inserted){composer.replaceChildren();const paragraph=document.createElement('p');paragraph.textContent=text;composer.append(paragraph);composer.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}))}
  }
  function insertWithBeforeInput(composer,text){
    composer.focus();
    composer.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertText',data:text}));
    insertWithNativeEditor(composer,text);
  }
  function insertWithDomFallback(composer,text){
    composer.focus();
    if('value'in composer){composer.value=text}else{composer.replaceChildren();const paragraph=document.createElement('p');paragraph.textContent=text;composer.append(paragraph)}
    composer.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));composer.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function composerContainsPrompt(composer,text){const actual=normalizeText('value'in composer?composer.value:composer.innerText||composer.textContent||'');const expected=normalizeText(text);return actual.length>0&&(actual===expected||actual.includes(expected.slice(0,Math.min(160,expected.length))))}
  function normalizeText(value){return String(value||'').replace(/\s+/g,' ').trim()}
  async function sha256(value){const bytes=new TextEncoder().encode(String(value||'')),digest=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
  function waitForStablePrompt(composer,text,timeout){return new Promise((resolve,reject)=>{const started=Date.now();let stableSince=0;const tick=()=>{if(composerContainsPrompt(composer,text)){if(!stableSince)stableSince=Date.now();if(Date.now()-stableSince>=450)return resolve(true)}else stableSince=0;if(Date.now()-started>=timeout)return reject(new Error('Prompt did not remain in the destination editor.'));setTimeout(tick,90)};tick()})}
  function attachThroughInput(input,files){try{const transfer=new DataTransfer();files.forEach(file=>transfer.items.add(file));input.files=transfer.files;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return input.files?.length||files.length}catch{return 0}}
  function dispatchFilePaste(composer,files){try{const transfer=new DataTransfer();files.forEach(file=>transfer.items.add(file));return composer.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}))}catch{return false}}
  async function waitForAttachmentsReady(files){
    const busySelectors=['[aria-busy="true"]','[role="progressbar"]','progress','[data-state="uploading"]','[class*="uploading"]','[class*="progress"]'];
    const previewSelectors=['[data-testid*="attachment"]','[class*="attachment"]','[class*="file-preview"]','[aria-label*="Remove file"]','[aria-label*="Remove attachment"]'];
    const started=Date.now();let stableSince=0;
    while(Date.now()-started<45000){
      const busy=busySelectors.some(selector=>[...document.querySelectorAll(selector)].some(element=>isVisible(element)));
      const previews=previewSelectors.flatMap(selector=>[...document.querySelectorAll(selector)]).filter(isVisible);
      const bodyText=(document.body.innerText||'').toLowerCase();
      const named=files.filter(file=>bodyText.includes(file.name.toLowerCase())).length;
      const enough=named===files.length||previews.length>=files.length;
      if(!busy&&enough){if(!stableSince)stableSince=Date.now();if(Date.now()-stableSince>900)return true}else stableSince=0;
      await delay(180);
    }
    throw new Error(`${platform} did not finish attaching all ${files.length} references. The intent was not inserted or submitted.`);
  }
  function isVisible(element){const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0}
  function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
  async function toFile(attachment){const response=await fetch(attachment.dataUrl),blob=await response.blob();return new File([blob],attachment.name||`reference-${attachment.id}`,{type:attachment.mime||blob.type||'application/octet-stream',lastModified:Date.now()})}
  function waitFor(factory,timeout,error){return new Promise((resolve,reject)=>{const started=Date.now(),tick=()=>{const value=factory();if(value)return resolve(value);if(Date.now()-started>=timeout)return reject(new Error(error));setTimeout(tick,180)};tick()})}
  // Web Cropper Overlay logic
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'start-selection') {
      startSelectionOverlay().then(sendResponse).catch(e => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });

  function startSelectionOverlay() {
    return new Promise((resolve) => {
      if (document.getElementById("viscue-selection-overlay")) return resolve({ ok: false });
      const overlay = document.createElement("div");
      overlay.id = "viscue-selection-overlay";
      Object.assign(overlay.style, { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 2147483647, cursor: "crosshair", background: "rgba(0,0,0,0.5)" });
      
      const cropBox = document.createElement("div");
      Object.assign(cropBox.style, { position: "absolute", border: "2px solid #ff315b", background: "transparent", display: "none", pointerEvents: "none", boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)" });
      
      const btnContainer = document.createElement("div");
      Object.assign(btnContainer.style, { position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "10px", zIndex: 2147483647 });
      
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      Object.assign(cancelBtn.style, { padding: "8px 16px", background: "#333", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontFamily: "system-ui" });
      
      const addBtn = document.createElement("button");
      addBtn.textContent = "Add Selection";
      addBtn.disabled = true;
      Object.assign(addBtn.style, { padding: "8px 16px", background: "#ff315b", color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", fontFamily: "system-ui", fontWeight: "bold" });
      
      btnContainer.append(cancelBtn, addBtn);
      overlay.append(cropBox, btnContainer);
      document.body.appendChild(overlay);
      
      let isDrawing = false, startX, startY, endX, endY;
      
      overlay.addEventListener("mousedown", e => { if(e.target === addBtn || e.target === cancelBtn) return; isDrawing = true; startX = e.clientX; startY = e.clientY; cropBox.style.display = "block"; cropBox.style.left = startX + "px"; cropBox.style.top = startY + "px"; cropBox.style.width = "0px"; cropBox.style.height = "0px"; });
      overlay.addEventListener("mousemove", e => { if (!isDrawing) return; endX = e.clientX; endY = e.clientY; cropBox.style.left = Math.min(startX, endX) + "px"; cropBox.style.top = Math.min(startY, endY) + "px"; cropBox.style.width = Math.abs(endX - startX) + "px"; cropBox.style.height = Math.abs(endY - startY) + "px"; addBtn.disabled = false; addBtn.style.cursor = "pointer"; });
      overlay.addEventListener("mouseup", e => { isDrawing = false; });
      
      cancelBtn.onclick = () => { overlay.remove(); resolve({ ok: false }); };
      addBtn.onclick = () => { 
        const rect = cropBox.getBoundingClientRect(); 
        overlay.remove();
        resolve({ ok: true, rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height, innerWidth: window.innerWidth, innerHeight: window.innerHeight } }); 
      };
    });
  }
})();
