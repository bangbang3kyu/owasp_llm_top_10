document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const flagInput = document.getElementById('flag-input');
    const verifyBtn = document.getElementById('verify-btn');
    const statusMsg = document.getElementById('status-msg');
    const nextBtn = document.getElementById('next-btn');

    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const clearKeyBtn = document.getElementById('clear-key-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const keyStatusMsg = document.getElementById('key-status-msg');

    let nextUrl = '';

    // ------------------------------------------------------------------ //
    // 메시지 렌더링
    //
    // 주의: 레벨 2 (Insecure Output Handling)는 의도적으로 innerHTML을 사용해
    // 봇의 응답을 이스케이프 없이 그대로 렌더링한다. 이것이 그 레벨이 시연하는
    // 취약점 그 자체이다. 다른 모든 레벨은 항상 innerText로 안전하게 렌더링된다.
    // ------------------------------------------------------------------ //
    function appendMessage(sender, text, type) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;
        
        const senderSpan = document.createElement('span');
        senderSpan.className = 'sender';
        senderSpan.innerText = sender.toUpperCase() + ':';
        
        const p = document.createElement('p');
        if (type === 'bot' && CURRENT_LEVEL === 2) {
            // 의도적으로 취약한 렌더링 (교육 목적: Insecure Output Handling 시연)
            p.innerHTML = text;
        } else {
            p.innerText = text;
        }
        
        msgDiv.appendChild(senderSpan);
        msgDiv.appendChild(p);
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        appendMessage('OPERATIVE', message, 'user');
        userInput.value = '';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: CURRENT_LEVEL, message: message })
            });
            const data = await response.json();
            
            // Artificial delay for "thinking" effect
            setTimeout(() => {
                appendMessage('SYSTEM', data.response, 'bot');
            }, 500);
        } catch (error) {
            appendMessage('SYSTEM', 'ERROR: Connection to neural link lost.', 'bot');
        }
    }

    async function verifyFlag() {
        const flag = flagInput.value.trim();
        if (!flag) return;

        try {
            const response = await fetch('/api/verify-flag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: CURRENT_LEVEL, flag: flag })
            });
            const data = await response.json();

            if (data.success) {
                statusMsg.style.color = 'var(--terminal-green)';
                statusMsg.innerText = 'ACCESS GRANTED: ' + data.message;
                nextBtn.classList.remove('hidden');
                nextUrl = data.next_url;
            } else {
                statusMsg.style.color = 'var(--danger-red)';
                statusMsg.innerText = 'ACCESS DENIED: ' + data.message;
                // Shake effect for input
                flagInput.style.borderColor = 'var(--danger-red)';
                setTimeout(() => flagInput.style.borderColor = '#444', 500);
            }
        } catch (error) {
            statusMsg.innerText = 'ERROR: Validation server offline.';
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    verifyBtn.addEventListener('click', verifyFlag);
    flagInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verifyFlag();
    });

    nextBtn.addEventListener('click', () => {
        if (nextUrl) {
            window.location.href = nextUrl;
        }
    });

    // ------------------------------------------------------------------ //
    // Gemini API 키 설정 모달
    // ------------------------------------------------------------------ //
    function openModal() {
        settingsModal.classList.remove('hidden');
        keyStatusMsg.innerText = '';
    }
    function closeModal() {
        settingsModal.classList.add('hidden');
    }

    async function checkKeyStatus(showModalIfMissing) {
        try {
            const res = await fetch('/api/key-status');
            const data = await res.json();
            if (!data.has_key && showModalIfMissing) {
                openModal();
                keyStatusMsg.style.color = 'var(--danger-red)';
                keyStatusMsg.innerText = 'API 키가 설정되지 않았습니다. 아래에 입력해주세요.';
            }
            return data.has_key;
        } catch (e) {
            return false;
        }
    }

    settingsBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);

    saveKeyBtn.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        if (!key) return;
        try {
            const res = await fetch('/api/set-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: key })
            });
            const data = await res.json();
            if (data.success) {
                keyStatusMsg.style.color = 'var(--terminal-green)';
                keyStatusMsg.innerText = 'API 키가 저장되었습니다.';
                apiKeyInput.value = '';
                setTimeout(closeModal, 800);
            }
        } catch (e) {
            keyStatusMsg.style.color = 'var(--danger-red)';
            keyStatusMsg.innerText = '저장 중 오류가 발생했습니다.';
        }
    });

    clearKeyBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/clear-key', { method: 'POST' });
            keyStatusMsg.style.color = 'var(--danger-red)';
            keyStatusMsg.innerText = 'API 키가 삭제되었습니다.';
        } catch (e) {
            // noop
        }
    });

    // 페이지 로드시 키가 없으면 자동으로 설정 모달을 띄운다
    checkKeyStatus(true);
});
