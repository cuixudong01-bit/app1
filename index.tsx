import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Chat } from "@google/genai";

// --- CONFIGURATION ---
// The API base URL is now relative to the domain, pointing to the Vercel Serverless Functions.
const API_BASE_URL = '';

// --- API HELPER FUNCTIONS ---
const getAuthToken = () => sessionStorage.getItem('fto_token');

const FTO_RULESET = `
规则集 (修订版 v8.0)：

FTO专利检索智能体规则集 (修订版 v8.0)
核心目标
生成高质量、高查全率的专利检索式，用于FTO分析，以识别出可能对输入的技术方案构成侵权风险的有效授权专利。
核心原则
分解与重构： 将复杂技术方案分解为最小技术特征单元，再根据风险高低和技术必要性进行逻辑重构。
人机协作： AI负责自动化处理和扩展，但关键节点的决策（如特征的确认、增删、定性）必须由用户完成。
全面性优先： FTO检索的目标是“防漏”，而非“求精”。

模块零：启动与功能选择 (NEW)

规则 0.1: 功能选择

智能体启动后, 首先向用户提供两个选项:

"欢迎使用FTO专利检索智能体。请选择您要执行的任务：

(A) 初步工作量评估：

(您提供技术方案，我将快速生成宽泛检索式，帮您评估该领域的结果数量级。)

(B) 正式FTO检索分析：

(我们将跳过评估，直接从详细的特征分解、范围界定和严谨的FTO检索开始。)"

智能体必须等待用户选择 (A) 或 (B)。


规则 0.2: 执行路径

如果用户选择 (A), 则执行 模块零-A (工作量评估)。

如果用户选择 (B), 则跳过评估模块, 直接执行 模块一 (详细范围界定)。


模块零-A：初步工作量评估 (Standalone Function)

规则 0-A.1: 接收技术方案

(当用户已选择A时触发)

"您已选择【初步工作量评估】。请输入您的产品技术方案（可粘贴详细的技术描述、文献或一篇相关的现有专利）。"

规则 0-A.2: 生成评估检索式
AI快速分析技术方案，提取1-3个最顶层、最核心的技术概念，并将其与上下文（如“减振器”、“模具”）组合，生成宽泛的检索式。

示例 (基于减振器案例):
宽泛检索 1 (常规式): ( (减振器 OR 阻尼器) AND (活塞 OR 缸) ) AND ( 气囊 OR 隔膜 OR "油气分离" OR 乳化 )
宽泛检索 2 (旋转式): ( (旋转 OR 转子 OR 叶片) AND (减振器 OR 阻尼器) ) AND IPC/CPC=(F16F9/* OR B61F5/*)


规则 0-A.3: 交付并提示下一步
AI交付检索式后，必须提示用户：
"评估检索式已生成，您可以执行它们来评估大概的工作量。
您是否希望现在开始**【正式FTO检索分析】**？ (是/否)"

规则 0-A.4: 转换
如果用户回答“是”，AI将携带已输入的技术方案，跳转至模块一（规则1.1的路径1）。
如果用户回答“否”，AI将待命，等待用户的新指令。


模块一：详细范围界定与特征分解

规则 1.1: 启动与接收输入
此规则根据用户的入口路径而变化：
路径1 (从模块零-A跳转而来)： "我们将基于您已提供的技术方案开始正式分析。请输入FTO基本范围信息：

目标国家/地区：
检索时间范围（选填）："
路径2 (直接选择B启动)： "您已选择【正式FTO检索分析】。为开始分析，请提供以下信息：
产品技术方案：
目标国家/地区：
检索时间范围（选填）："
规则 1.2: 智能提取技术特征
规则 1.3: 结构化呈现特征列表并预判等级
将特征分为[核心必要特征, 改进/可选特征, 背景/通用特征]。


模块二：用户确认与交互
规则 2.1: 呈现、请求确认并同步询问
提示用户审核、修改、增删技术特征，并确认“核心等级”。
提示用户（选填）提供目标专利权人。
规则 2.2: 提供交互接口
规则 2.3: 锁定最终信息

模块三：关键词与分类号扩展
规则 3.1: 同义词/上下位词扩展
规则 3.2: 专利分类号映射
规则 3.3: 【关键规则】主动要求用户确认扩展
智能体必须主动向用户提示，要求人工确认和补充。
提示话术示例： "为确保检索全面性，请您协助对以下核心关键词进行扩展确认。AI的扩展可能不足，例如‘脱模’还可能扩展为‘拆模’、‘去模’等，请您补充或确认：..."


模块四：检索式构建与输出
规则 4.1: 【关键规则】检索方式选择
智能体必须首先询问用户：
"检索策略已准备就绪。请您选择检索执行方式：
(A) 长字符串检索（Single Query）： 我将为您生成包含所有逻辑的、可一次性执行的完整检索式，适合逐步迭代和报告。
(B) 分块检索（Building-Block）： 我将引导您分别检索每一个技术特征“簇”(S1, S2, S3...)，然后将这些结果集在数据库中进行布尔组合。此方式更灵活，易于调试。"
规则 4.2: 检索路径 A (长字符串检索)
4.2.1 核心检索 (n query): ((特征A扩展词) AND (特征B扩展词) AND ...)
4.2.2 放宽检索 (n-1 query): ((特征A扩展词) AND (特征B扩展词))
4.2.3 原理分离检索 (Principle Separation): 必须使用 NOT 逻辑分离互斥原理（如K3脱模装置案例）。
规则 4.3: 检索路径 B (分块检索)
4.3.1 定义特征簇 (Blocks): 引导用户分步执行 S1 = (...), S2 = (...)。
4.3.2 组合结果集 (Combining Sets): 引导用户组合 S1 AND S2 AND S3 (n query) 和 S1 AND S2 (n-1 query)。


规则 4.4: 【关键规则】检索式质量与语法要求
(A) 语法通用性： 检索式必须可直接复制粘贴。严禁使用特定数据库的专有语法（例如 5..20）。
(B) 关键词精准性： 智能体必须主动避免在检索式中使用会导致噪音的“中文单字”（例如 打、挡），除非该单字是特定技术名词（例如 泵）。


模块五：结果收集与迭代 (Feedback Loop)

规则 5.1: 【关键规则】主动收集检索结果
在用户执行完模块四生成的检索式后，智能体必须主动提示用户输入检索结果。
提示话术（示例对话框）：
"您已执行检索。为帮助我分析策略的有效性并进行下一步迭代，请您在下方输入框中提供以下信息：
检索结果数量： （例如：36160篇，或 512篇）
发现的线索文献： （请列出您发现的高相关文献的公开号，例如 CN212704270U）
噪音关键词（可选）： （您是否发现了大量重复出现的、不相关的噪音词？例如：“压铸”）"
规则 5.2: 接收反馈并启动迭代
AI接收用户的反馈后，必须根据反馈内容执行下一步动作：
情况A (噪音过大)： 如果用户反馈数量过大，AI应回应："结果数量过大。让我们回到**[模块四]**，使用 NOT 逻辑或增加新的限定词来精炼检索式。"

情况B (发现新线索)： 如果用户提供了线索文献。AI应回应："您发现的新文献非常关键。我将立即分析它，并回到**[模块三]**，将新发现的关键词（如‘雾化’）加入我们的关键词表，然后重新构建检索式。"

情况C (结果可控)： 如果用户反馈数量可控。AI应回应："好的，检索结果（XX篇）已确认。这个风险池数量可控。我们将进入**[模块六]**，开始FTO比对分析。"


模块六：FTO分析与比对原则 (Analysis & Comparison Rules)
规则 6.1: 检索后提示
在交付最终检索池后，智能体应主动提示用户，后续的FTO比对应遵循以下核心原则。
规则 6.2: 严格比对独立权利要求 1
比对必须首先从对比文献的独立权利要求1开始。
规则 6.3: 全面覆盖原则 (All Elements Rule)
(A) 低风险： 如果独立权利要求1中至少有一个技术特征（A），在标的技术方案中找不到相同或等同的特征（a），则不落入保护范围。
(B) 高风险： 如果独立权利要求1中的所有技术特征（A, B）在标的技术方案中都能找到相同或等同的特征（a, b），则落入保护范围（即使标的技术方案还包含额外的特征 c, d...）。


规则 6.4: 【关键规则】主动提示争议点

在进行特征比对时，智能体必须主动识别“非完全相同”但可能构成等同的特征，并将其标记为**“可能存在争议”**，以提示用户进行深入的法律核查。
争议点示例1 (上位概念)： 标的（雾化） vs 权利要求（喷嘴/喷头/喷水）。
争议点示例2 (技术等同)： 标的（圆锥+球顶） vs 权利要求（锥台）。
争议点示例3 (阀门)： 标的（必然包含阀门） vs 权利要求（电磁阀门）。
`;

interface Message {
  role: 'user' | 'model';
  htmlContent: string;
}

interface User {
    username: string;
    role: 'user' | 'admin';
}

interface ApiUser extends User {
    // Backend may send other fields we don't use in the frontend
}

const FtoChatApp = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialChoiceMade, setInitialChoiceMade] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  const handleStream = async (stream: AsyncGenerator<any>, currentHistory: Message[]) => {
      let modelResponse = '';
      let hasReceivedContent = false;

      for await (const chunk of stream) {
          hasReceivedContent = true;
          modelResponse += chunk.text;
          const modelHtmlResponse = (window as any).marked.parse(modelResponse);

          setChatHistory(() => [
              ...currentHistory,
              { role: 'model', htmlContent: modelHtmlResponse },
          ]);
      }

      if (!hasReceivedContent) {
          setChatHistory(currentHistory); // Remove placeholder if stream is empty
      }
  };

  const startChat = async (choice: 'A' | 'B') => {
    setInitialChoiceMade(true);
    setError('');
    setLoading(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const newChat = ai.chats.create({
        model: 'gemini-2.5-pro',
        config: {
          systemInstruction: FTO_RULESET,
        },
      });
      setChat(newChat);

      const initialUserMessageText = choice === 'A' 
          ? "用户选择 (A) 初步工作量评估" 
          : "用户选择 (B) 正式FTO检索分析";

      const userMessage: Message = { role: 'user', htmlContent: initialUserMessageText };
      const modelPlaceholder: Message = { 
          role: 'model', 
          htmlContent: '<div class="typing-indicator"><span></span><span></span><span></span></div>'
      };
      
      const initialHistory = [userMessage];
      setChatHistory([...initialHistory, modelPlaceholder]);

      const stream = await newChat.sendMessageStream({ message: initialUserMessageText });
      await handleStream(stream, initialHistory);

    } catch (err) {
        console.error(err);
        setError('初始化对话时发生错误，请刷新页面重试。');
        setChatHistory([]); // Clear history on error
    } finally {
        setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = currentMessage;
    if (!message.trim() || loading || !chat) {
        return;
    }
    
    setLoading(true);
    setError('');
    setCurrentMessage('');

    const userMessage: Message = { role: 'user', htmlContent: message };
    const modelPlaceholder: Message = { 
        role: 'model', 
        htmlContent: '<div class="typing-indicator"><span></span><span></span><span></span></div>'
    };
    
    const currentHistory = [...chatHistory, userMessage];
    setChatHistory([...currentHistory, modelPlaceholder]);

    try {
        const stream = await chat.sendMessageStream({ message: message });
        await handleStream(stream, currentHistory);
    } catch (err) {
        console.error(err);
        setError('发送消息时发生错误，请稍后再试。');
        setChatHistory(chatHistory); // Revert to history before the failed message
    } finally {
        setLoading(false);
    }
  };
  
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleImportClick = () => {
    alert('请打开您的 Word/PDF 文档, 复制其内容, 然后粘贴到下方的消息框中。');
  };

  return (
    <div className="container" role="main">
        {!initialChoiceMade ? (
          <section className="initial-choice-container">
            <h2>欢迎使用，请选择任务：</h2>
            <div className="choice-buttons">
              <button className="choice-button" onClick={() => startChat('A')}>
                <strong>(A) 初步工作量评估</strong>
                <p>提供技术方案，快速生成宽泛检索式，评估结果数量级。</p>
              </button>
              <button className="choice-button" onClick={() => startChat('B')}>
                <strong>(B) 正式FTO检索分析</strong>
                <p>直接开始详细的特征分解、范围界定和严谨的FTO检索。</p>
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="chat-container" aria-live="polite">
              {chatHistory.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.role}`}>
                  <div className="message-bubble" dangerouslySetInnerHTML={{ __html: msg.htmlContent }}></div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </section>
            
            {error && <p className="error" role="alert">{error}</p>}
            
            <section className="input-form-container">
              <form onSubmit={handleSubmit} className="input-form">
                <textarea
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="在此输入您的回复..."
                  aria-label="在此输入您的回复"
                  rows={1}
                  disabled={loading}
                />
                <button 
                  type="button" 
                  className="import-button" 
                  onClick={handleImportClick} 
                  disabled={loading}
                  aria-label="Import document"
                >
                  📎 导入
                </button>
                <button type="submit" className="send-button" disabled={loading || !currentMessage.trim()}>
                  发送
                </button>
              </form>
            </section>
          </>
        )}
      </div>
  )
};

const LoginScreen = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '登录失败。');
            }

            sessionStorage.setItem('fto_user', JSON.stringify(data.user));
            sessionStorage.setItem('fto_token', data.token);
            onLoginSuccess(data.user);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h1>FTO 专利检索智能体</h1>
                <p>请登录以继续</p>
                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label htmlFor="username">用户名</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">密码</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    {error && <p className="error" style={{textAlign: 'left', padding: '0 10px'}}>{error}</p>}
                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? '登录中...' : '登录'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const AdminPanel = () => {
    const [users, setUsers] = useState<ApiUser[]>([]);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const token = getAuthToken();
            const response = await fetch(`${API_BASE_URL}/api/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('获取用户列表失败。');
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const addUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');
        if (!newUsername || !newPassword) {
            setError('用户名和密码不能为空。');
            return;
        }

        try {
            const token = getAuthToken();
            const response = await fetch(`${API_BASE_URL}/api/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username: newUsername, password: newPassword, role: 'user' }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || '添加用户失败。');
            
            setMessage(`用户 "${newUsername}" 已成功添加。`);
            setNewUsername('');
            setNewPassword('');
            fetchUsers(); // Refresh the list
        } catch (err) {
            setError(err.message);
        }
    };

    const deleteUser = async (username: string) => {
        if (username === 'admin') {
            setError('不能删除管理员账户。');
            return;
        }
        if (window.confirm(`您确定要删除用户 "${username}" 吗？此操作无法撤销。`)) {
            setMessage('');
            setError('');
            try {
                const token = getAuthToken();
                const response = await fetch(`${API_BASE_URL}/api/users/${username}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || '删除用户失败。');

                setMessage(data.message);
                fetchUsers(); // Refresh the list
            } catch (err) {
                setError(err.message);
            }
        }
    };
    
    return (
        <div className="container admin-panel">
            <h2>用户管理面板</h2>
            <p>在这里您可以添加或删除普通用户账户。</p>
            {error && <p className="error">{error}</p>}

            <div className="admin-section">
                <h3>添加新用户</h3>
                <form onSubmit={addUser} className="admin-form">
                    <input
                        type="text"
                        placeholder="新用户名"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="新密码"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                    />
                    <button type="submit">添加用户</button>
                </form>
                {message && <p className="admin-message">{message}</p>}
            </div>

            <div className="admin-section">
                <h3>现有用户列表</h3>
                {loading ? <p>正在加载用户...</p> : (
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>用户名</th>
                                <th>角色</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.username}>
                                    <td>{user.username}</td>
                                    <td>{user.role}</td>
                                    <td>
                                        <button
                                            onClick={() => deleteUser(user.username)}
                                            disabled={user.username === 'admin'}
                                            className="delete-button"
                                        >
                                            删除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <div className="admin-section">
              <h3>安全提示</h3>
              <p className="security-note">
                  用户数据现在由安全的后端服务管理。所有密码都经过哈希加密处理，确保数据安全。
                  <br /><strong>注意:</strong> 为演示目的，当前数据存储在内存中，服务重启后将重置。
              </p>
            </div>
        </div>
    );
};


const App = () => {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(() => {
    const savedUser = sessionStorage.getItem('fto_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [view, setView] = useState<'fto' | 'admin'>('fto');

  const handleLogout = () => {
    sessionStorage.removeItem('fto_user');
    sessionStorage.removeItem('fto_token');
    setLoggedInUser(null);
  };

  if (!loggedInUser) {
    return <LoginScreen onLoginSuccess={setLoggedInUser} />;
  }

  return (
    <>
      <style>{`
        :root {
          --primary-color: #007bff;
          --primary-color-hover: #0056b3;
          --background-color: #f8f9fa;
          --text-color: #333;
          --card-background: #fff;
          --border-color: #dee2e6;
          --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          --box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          --border-radius: 12px;
          --user-message-bg: #007bff;
          --model-message-bg: #e9ecef;
          --model-message-text: #333;
          --danger-color: #dc3545;
          --danger-color-hover: #c82333;
        }
        html, body {
            height: 100%;
        }
        body {
          margin: 0;
          font-family: var(--font-family);
          background-color: var(--background-color);
          color: var(--text-color);
          display: flex;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
        }
        #root {
          width: 100%;
          max-width: 800px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .app-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background-color: var(--card-background);
          box-shadow: var(--box-shadow);
          border-radius: var(--border-radius);
          overflow: hidden;
        }
        .main-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 20px;
            border-bottom: 1px solid var(--border-color);
            background-color: #fff;
        }
        .main-header h1 {
            color: var(--primary-color);
            margin: 0;
            font-size: 1.5rem;
        }
        .header-controls {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .header-controls span {
            font-size: 0.9rem;
            color: #6c757d;
        }
        .header-button {
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s, color 0.2s, border-color 0.2s;
            border: 1px solid var(--border-color);
            background-color: transparent;
        }
        .header-button:hover {
            background-color: #f0f0f0;
        }
        .logout-button {
            border-color: var(--primary-color);
            color: var(--primary-color);
        }
        .logout-button:hover {
            background-color: var(--primary-color);
            color: white;
        }
        .main-content {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .container {
          background-color: transparent;
          box-shadow: none;
          border-radius: 0;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: auto;
          flex-grow: 1;
        }
        .chat-container {
          flex-grow: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .chat-message {
            display: flex;
            gap: 10px;
            max-width: 85%;
        }
        .message-bubble {
            padding: 12px 18px;
            border-radius: 18px;
            line-height: 1.6;
        }
        .chat-message.user {
            align-self: flex-end;
            flex-direction: row-reverse;
        }
        .chat-message.user .message-bubble {
            background-color: var(--user-message-bg);
            color: white;
            border-bottom-right-radius: 4px;
        }
        .chat-message.model {
            align-self: flex-start;
        }
        .chat-message.model .message-bubble {
            background-color: var(--model-message-bg);
            color: var(--model-message-text);
            border-bottom-left-radius: 4px;
        }
        .message-bubble h3 { margin-top: 0; }
        .message-bubble ul, .message-bubble ol { padding-left: 20px; }
        .message-bubble code { background-color: rgba(0,0,0,0.08); padding: 2px 4px; border-radius: 4px; }
        .message-bubble pre { background-color: rgba(0,0,0,0.08); padding: 16px; border-radius: 6px; overflow-x: auto; }
        .input-form-container {
            padding: 20px;
            border-top: 1px solid var(--border-color);
            background-color: var(--card-background);
        }
        .input-form {
            display: flex;
            align-items: flex-end;
            gap: 12px;
        }
        textarea {
          flex-grow: 1;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          font-family: inherit;
          font-size: 16px;
          resize: none;
          min-height: 24px;
          max-height: 150px;
          box-sizing: border-box;
          line-height: 1.5;
        }
        textarea:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
        .send-button, .import-button {
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.2s, color 0.2s, border-color 0.2s;
          white-space: nowrap;
          height: 48px;
        }
        .send-button {
          border: none;
          background-color: var(--primary-color);
          color: white;
        }
        .send-button:hover:not(:disabled) {
          background-color: var(--primary-color-hover);
        }
        .send-button:disabled {
          background-color: #a0c7ff;
          cursor: not-allowed;
        }
        .import-button {
          background-color: transparent;
          color: var(--primary-color);
          border: 1px solid var(--border-color);
        }
        .import-button:hover:not(:disabled) {
          background-color: #f0f8ff;
          border-color: var(--primary-color);
        }
        .import-button:disabled {
          color: #aaa;
          background-color: #f8f9fa;
          cursor: not-allowed;
        }
        .error {
          color: #d9534f;
          text-align: center;
          padding: 10px 20px;
        }
        .initial-choice-container {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100%;
            padding: 24px;
            text-align: center;
        }
        .initial-choice-container h2 {
            margin-bottom: 24px;
        }
        .choice-buttons {
            display: flex;
            flex-direction: column;
            gap: 16px;
            width: 100%;
            max-width: 400px;
        }
        .choice-button {
            padding: 16px;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            background-color: var(--card-background);
            cursor: pointer;
            transition: all 0.2s;
            text-align: left;
        }
        .choice-button:hover {
            border-color: var(--primary-color);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .typing-indicator {
            display: flex;
            padding: 10px;
            align-items: center;
        }
        .typing-indicator span {
            height: 8px;
            width: 8px;
            background-color: #999;
            border-radius: 50%;
            display: inline-block;
            margin: 0 2px;
            animation: bounce 1.4s infinite ease-in-out both;
        }
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1.0); }
        }
        .login-container {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
        }
        .login-box {
            background: var(--card-background);
            padding: 40px;
            border-radius: var(--border-radius);
            box-shadow: var(--box-shadow);
            width: 100%;
            max-width: 400px;
            text-align: center;
        }
        .login-box h1 {
            color: var(--primary-color);
            margin-top: 0;
            margin-bottom: 10px;
        }
        .login-box p {
            color: #6c757d;
            margin-bottom: 30px;
        }
        .input-group {
            margin-bottom: 20px;
            text-align: left;
        }
        .input-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
        }
        .input-group input {
            width: 100%;
            padding: 12px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            font-size: 1rem;
            box-sizing: border-box;
        }
        .input-group input:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
        .login-button {
            width: 100%;
            padding: 12px;
            border: none;
            background-color: var(--primary-color);
            color: white;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
            transition: background-color 0.2s;
            margin-top: 10px;
        }
        .login-button:hover:not(:disabled) {
            background-color: var(--primary-color-hover);
        }
        .login-button:disabled {
            background-color: #a0c7ff;
            cursor: not-allowed;
        }
        
        /* Admin Panel Styles */
        .admin-panel {
            padding: 24px;
        }
        .admin-panel h2, .admin-panel h3 {
            color: var(--primary-color);
        }
        .admin-section {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid var(--border-color);
        }
        .admin-form {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
        }
        .admin-form input {
            flex-grow: 1;
            padding: 10px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
        }
        .admin-form button {
            padding: 10px 20px;
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
        .admin-form button:hover {
            background-color: var(--primary-color-hover);
        }
        .admin-message {
            color: #28a745;
        }
        .users-table {
            width: 100%;
            border-collapse: collapse;
        }
        .users-table th, .users-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }
        .users-table th {
            background-color: #e9ecef;
        }
        .delete-button {
            padding: 6px 12px;
            background-color: var(--danger-color);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
        .delete-button:hover {
            background-color: var(--danger-color-hover);
        }
        .delete-button:disabled {
            background-color: #f5c6cb;
            cursor: not-allowed;
        }
        .security-note {
            font-size: 0.9em;
            color: #6c757d;
            background-color: #e9ecef;
            padding: 15px;
            border-radius: 6px;
        }
      `}</style>
      <div className="app-wrapper">
        <header className="main-header">
            <h1>FTO 智能体</h1>
            <div className="header-controls">
                <span>欢迎, {loggedInUser.username}</span>
                {loggedInUser.role === 'admin' && (
                    <button
                        className="header-button"
                        onClick={() => setView(view === 'fto' ? 'admin' : 'fto')}
                    >
                        {view === 'fto' ? '管理面板' : '返回应用'}
                    </button>
                )}
                <button onClick={handleLogout} className="header-button logout-button">登出</button>
            </div>
        </header>
        <main className="main-content">
            {view === 'fto' ? <FtoChatApp /> : <AdminPanel />}
        </main>
      </div>
    </>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
