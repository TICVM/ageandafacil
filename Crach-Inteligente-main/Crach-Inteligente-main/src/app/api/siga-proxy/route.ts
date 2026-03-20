
import { NextResponse } from 'next/server';

/**
 * Proxy avançado para o Activesoft.
 * Suporta busca de dados (GET) e autenticação automática (POST).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, token, action, username, password } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL da API não fornecida.' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    // --- AÇÃO DE LOGIN ---
    if (action === 'login') {
      // O Activesoft geralmente usa /api/v1/auth/login/ ou /api/v1/token/
      // Tentamos construir a URL de login baseada na URL base fornecida
      const baseUrl = new URL(url).origin;
      const loginUrl = `${baseUrl}/api/v1/auth/login/`;

      const loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        cache: 'no-store'
      });

      if (!loginResponse.ok) {
        const errText = await loginResponse.text();
        return NextResponse.json({ error: 'Falha no login do SIGA', details: errText }, { status: loginResponse.status });
      }

      const loginData = await loginResponse.json();
      // Retorna o token capturado (geralmente está em 'token', 'access' ou 'key')
      const capturedToken = loginData.token || loginData.access || loginData.key;
      
      if (!capturedToken) {
        return NextResponse.json({ error: 'Login realizado, mas token não encontrado na resposta.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, token: capturedToken });
    }

    // --- AÇÃO DE BUSCA (FETCH) ---
    if (token) {
      const cleanToken = token.trim();
      const lowerToken = cleanToken.toLowerCase();
      if (lowerToken.startsWith('bearer ') || lowerToken.startsWith('token ')) {
        headers['Authorization'] = cleanToken;
      } else {
        headers['Authorization'] = `Bearer ${cleanToken}`;
      }
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { detail: errorText };
      }

      const remoteError = errorData.detail || errorData.details || errorData.error || errorText;
      return NextResponse.json({ 
        error: `Erro na API Activesoft: ${response.status}`, 
        details: remoteError 
      }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Erro no Siga Proxy:', error);
    return NextResponse.json({ 
      error: 'Erro crítico ao conectar com o servidor do SIGA.', 
      details: error.message 
    }, { status: 500 });
  }
}
