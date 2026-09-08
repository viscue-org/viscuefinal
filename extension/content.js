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
  const extensionId=chrome.runtime.id||'viscue';
  const extensionVersion=chrome.runtime.getManifest?.().version||'0.0.0';

  function queryFirst(selectors){for(const selector of selectors){const element=document.querySelector(selector);if(element)return element}return null}
  function compareVersions(left,right){const a=String(left||'0').split('.').map(Number),b=String(right||'0').split('.').map(Number);for(let i=0;i<Math.max(a.length,b.length);i++){const delta=(a[i]||0)-(b[i]||0);if(delta)return delta}return 0}
  function ownsEntry(element){return element?.dataset?.viscueExtensionId===extensionId}
  function shouldClaimEntry(element){if(!element)return true;if(ownsEntry(element))return false;const ownerId=element.dataset?.viscueExtensionId;if(!ownerId)return true;const versionOrder=compareVersions(extensionVersion,element.dataset?.viscueVersion);return versionOrder>0||(versionOrder===0&&extensionId.localeCompare(ownerId)<0)}
  function addEntry(){const existing=document.getElementById(entryId);if(!shouldClaimEntry(existing))return;const composer=queryFirst(adapter.composer);if(!composer)return;existing?.remove();const button=document.createElement('button');button.id=entryId;button.type='button';button.dataset.viscueExtensionId=extensionId;button.dataset.viscueVersion=extensionVersion;button.textContent='Open Viscue';button.setAttribute('aria-label','Open Viscue visual workspace');button.title='Open the Viscue visual intent workspace';button.addEventListener('click',()=>{Promise.resolve(chrome.runtime.sendMessage({type:'open-workspace'})).then(response=>{if(response?.ok===false&&!response.authenticated){button.textContent='Viscue needs attention';button.title=response.error||'Open the Viscue extension and sign in.'}}).catch(()=>{button.textContent='Reload Viscue';button.title='Reload the Viscue extension from chrome://extensions.'})});document.body?.append(button)}
  addEntry();new MutationObserver(addEntry).observe(document.documentElement,{childList:true,subtree:true});

  function extractLiveChatContext() {
    const pathname = location.pathname;
    let chatId = '';
    if (platform === 'Gemini') {
      const m = pathname.match(/\/app(?:\/u\/\d+)?\/([a-zA-Z0-9_-]+)/);
      chatId = m ? m[1] : (pathname.startsWith('/app') ? 'new' : pathname);
    } else if (platform === 'Claude') {
      const m = pathname.match(/\/(?:chat|project)\/([a-zA-Z0-9_-]+)/);
      chatId = m ? m[1] : (pathname === '/new' || pathname === '/' ? 'new' : pathname);
    } else if (platform === 'Copilot') {
      const qChat = new URLSearchParams(location.search).get('conversationId');
      const m = pathname.match(/\/(?:chats|sl)\/([a-zA-Z0-9_-]+)/);
      chatId = qChat || (m ? m[1] : (pathname === '/' ? 'new' : pathname));
    } else if (platform === 'Perplexity') {
      const m = pathname.match(/\/(?:search|q)\/([a-zA-Z0-9_-]+)/);
      chatId = m ? m[1] : (pathname === '/' || pathname === '/search/new' ? 'new' : pathname);
    } else if (platform === 'Grok') {
      const qChat = new URLSearchParams(location.search).get('conversation');
      const m = pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
      chatId = qChat || (m ? m[1] : (pathname === '/' ? 'new' : pathname));
    } else {
      const m = pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
      chatId = m ? m[1] : (pathname === '/' ? 'new' : pathname);
    }
    chatId = String(chatId || '').replace(/^\/+|\/+$/g, '').trim() || 'new';
    const destinationFingerprint = `${platform}:${chatId === 'new' ? pathname : chatId}`;
    return {
      platform,
      url: location.href,
      pathname,
      chatId,
      destinationFingerprint,
      isNewChat: chatId === 'new',
    };
  }

  chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
    if(message.type==='get-chat-context'){sendResponse({ok:true,context:extractLiveChatContext()});return true}
    if(message.type==='insert-prompt'){insertPrompt(message.prompt).then(ok=>sendResponse(ok?{ok:true}:{ok:false,error:'Destination composer was not found.'}));return true}
    if(message.type==='handoff'){runHandoff(message).then(sendResponse).catch(error=>sendResponse({ok:false,error:error.message}));return true}
  });

  async function clearStaleComposerAttachments(composer){
    const root = composer ? (composer.closest('form') || composer.closest('[role="presentation"]') || composer.closest('[class*="composer"]') || composer.closest('main') || composer.parentElement?.parentElement || document) : document;
    for (let pass = 0; pass < 3; pass++) {
      let removed = 0;
      const imgs = root.querySelectorAll('img');
      for (const img of imgs) {
        if (composer && composer.contains(img)) continue;
        const card = img.closest('div, li, [role="group"]') || img.parentElement;
        if (!card || !root.contains(card)) continue;
        card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        const btns = card.querySelectorAll('button');
        for (const btn of btns) {
          try {
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            btn.click();
            removed++;
          } catch {}
        }
      }
      const removeSelectors = [
        'button[aria-label*="Remove" i]',
        'button[aria-label*="Delete" i]',
        'button[aria-label*="Dismiss" i]',
        'button[aria-label*="Clear" i]',
        'button[aria-label*="Close" i]',
        'button[data-testid*="remove" i]',
        'button[data-testid*="delete" i]',
        'button[data-testid*="close" i]',
        'div[class*="attachment" i] button',
        'div[class*="file-preview" i] button',
        'div[class*="thumbnail" i] button',
        'li[class*="attachment" i] button',
        '[class*="pill" i] button'
      ];
      for (const selector of removeSelectors) {
        const buttons = root.querySelectorAll(selector);
        for (const btn of buttons) {
          if (btn.getAttribute('data-testid') === 'send-button') continue;
          const label = (btn.getAttribute('aria-label') || '').toLowerCase();
          if (label.includes('send') || label.includes('voice') || label.includes('attach') || label.includes('submit')) continue;
          try {
            btn.click();
            removed++;
          } catch {}
        }
      }
      if (removed > 0) {
        await delay(200);
      } else {
        break;
      }
    }
  }

  async function runHandoff({prompt,attachments=[],submit=false,executionId,destinationFingerprint,promptHash,tabId}){
    const liveCtx = extractLiveChatContext();
    const actualDestination = liveCtx.destinationFingerprint;
    const pathDestination = `${platform}:${location.pathname}`;
    const isMatch = !destinationFingerprint ||
      destinationFingerprint === actualDestination ||
      destinationFingerprint === pathDestination ||
      (destinationFingerprint.endsWith(':new') || destinationFingerprint.endsWith(':/') || destinationFingerprint.endsWith(':/app') || destinationFingerprint.endsWith(':/new'));
    if(!isMatch){
      console.warn('[Viscue handoff] destination mismatch', { destinationFingerprint, actualDestination, pathDestination });
      throw new Error('The destination conversation changed after compilation. Nothing was attached or submitted.');
    }
    if(promptHash){
      const computedNorm=await sha256(normalizeForHash(prompt));
      const computedRaw=await sha256(prompt);
      const targetHash=String(promptHash).toLowerCase().trim();
      if(computedNorm.toLowerCase()!==targetHash&&computedRaw.toLowerCase()!==targetHash){
        console.warn('[Viscue handoff] prompt hash mismatch',{promptHash,computedNorm,computedRaw});
        throw new Error('The compiled prompt hash does not match this handoff. Nothing was attached or submitted.');
      }
    }
    const composer=await waitFor(()=>queryFirst(adapter.composer),8000,'Destination composer was not found.');
    await clearStaleComposerAttachments(composer);
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
    const finalReceipt = {
      ...globalThis.ViscueHandoff.buildReceipt({executionId,destinationFingerprint:liveCtx.destinationFingerprint,promptHash,attachments:confirmedAttachments,promptVerified:true,submitted:Boolean(submit)}),
      tabId,
      chatId: liveCtx.chatId,
      platform,
    };
    if(!submit)return{ok:true,attached,...finalReceipt};
    const sendButton=await waitFor(()=>{const button=queryFirst(adapter.send);return button&&!button.disabled?button:null},15000,'The destination Send button did not become ready.');
    if(!composerContainsPrompt(composer,prompt))throw new Error('The destination editor lost the instruction before submission. Nothing was sent.');
    sendButton.click();
    console.info('[Viscue handoff] submit clicked',{platform});
    await delay(350);
    const postSubmitCtx = extractLiveChatContext();
    finalReceipt.destination_fingerprint = postSubmitCtx.destinationFingerprint;
    finalReceipt.chatId = postSubmitCtx.chatId;
    return{ok:true,attached,...finalReceipt};
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
  function normalizeForHash(value){return String(value||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim()}
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
