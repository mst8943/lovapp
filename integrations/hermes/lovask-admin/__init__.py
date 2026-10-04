"""Deterministic Lovask commands in the existing Hermes Telegram gateway."""

import asyncio
import json
import subprocess
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def _env(path):
    values = {}
    for line in Path(path).read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"\'')
    return values


def _post(payload):
    secret = _env('/etc/hermes-notifier.env').get('NOTIFIER_SECRET')
    if not secret:
        return 'Lovask bağlantısı yapılandırılmamış.'
    request = Request('http://127.0.0.1:3007/api/internal/hermes-admin',
                      data=json.dumps(payload).encode(),
                      headers={'Authorization': f'Bearer {secret}', 'Content-Type': 'application/json'},
                      method='POST')
    try:
        with urlopen(request, timeout=12) as response:
            return json.load(response)
    except HTTPError as error:
        try:
            return {'error': json.load(error).get('error', f'HTTP {error.code}')}
        except Exception:
            return {'error': f'HTTP {error.code}'}
    except Exception:
        return {'error': 'Lovask sunucusuna erişilemiyor.'}


def _format(result, action):
    if isinstance(result, str):
        return result
    if result.get('error'):
        return result['error']
    if action == 'support_list':
        rows = result.get('tickets', [])
        return 'Açık destek talebi yok.' if not rows else '\n'.join(
            f"{r['id']} · {r['subject']} · {r['status']}" for r in rows)
    if action == 'support_detail':
        ticket = result['ticket']
        lines = [f"{ticket['subject']} · {ticket['status']}"]
        lines += [f"{'Üye' if m['sender_profile_id'] else 'Yönetim'}: {m['body'][:800]}" for m in result.get('messages', [])]
        return '\n'.join(lines)[:3800]
    if action == 'payment_list':
        rows = result.get('orders', [])
        return 'Onay bekleyen ödeme yok.' if not rows else '\n'.join(
            f"{r['id']} · {r['amount']} {r['currency']} · {r['provider']} · Shopier: {r.get('external_reference') or '-'}" for r in rows)
    if action == 'support_reply':
        return 'Destek yanıtı gönderildi.' if result.get('sent') else 'Yanıt gönderilemedi.'
    if action == 'payment_approve':
        return f"Noir onaylandı. Bitiş: {result.get('noirUntil')}" if result.get('approved') else 'Onay yapılamadı.'
    return 'Bilinmeyen yanıt.'


async def _handle(raw):
    parts = raw.strip().split()
    if not parts or parts[0] in ('yardim', 'help'):
        return ('/lovask destek · açık talepler\n'
                '/lovask talep <talep-id> · son mesajlar\n'
                '/lovask cevap <talep-id> <yanıt> · üyeye yanıt\n'
                '/lovask odeme · bekleyen ödemeler\n'
                '/lovask onay <sipariş-id> <Shopier-no> <tutar> · Shopier panelinde doğruladıktan sonra Noir aç\n'
                '/ai_bakiye · bot konuşmalarının sağlayıcı bakiyesi')
    if parts[0] == 'bakiye':
        result = await asyncio.to_thread(subprocess.run,
            ['/root/.local/bin/node', '--env-file=/var/www/lovask/.env.production.local',
             '/var/www/lovask/scripts/lovask-ai-balance.mjs'],
            capture_output=True, text=True, timeout=15)
        return result.stdout.strip() if result.returncode == 0 else 'AI bakiyesi okunamadı.'
    command = parts[0]
    if command == 'destek' and len(parts) == 1:
        payload = {'action': 'support_list'}
    elif command == 'talep' and len(parts) == 2:
        payload = {'action': 'support_detail', 'ticketId': parts[1]}
    elif command == 'cevap' and len(parts) >= 3:
        payload = {'action': 'support_reply', 'ticketId': parts[1], 'reply': ' '.join(parts[2:])}
    elif command == 'odeme' and len(parts) == 1:
        payload = {'action': 'payment_list'}
    elif command == 'onay' and len(parts) == 4:
        try:
            amount = float(parts[3].replace(',', '.'))
        except ValueError:
            return 'Tutar sayı olmalı. Örnek: 199'
        payload = {'action': 'payment_approve', 'orderId': parts[1], 'shopierOrderNumber': parts[2], 'amount': amount}
    else:
        return 'Komut anlaşılmadı. /lovask yardım yaz.'
    return _format(await asyncio.to_thread(_post, payload), payload['action'])


def register(ctx):
    # The gateway only allows one Telegram user and sends to that user's private chat.
    env = _env('/root/.hermes/.env')
    allowed = [item.strip() for item in env.get('TELEGRAM_ALLOWED_USERS', '').split(',') if item.strip()]
    if len(allowed) != 1 or env.get('TELEGRAM_HOME_CHANNEL') != allowed[0]:
        return
    ctx.register_command('lovask', _handle, description='Lovask destek ve ödeme yönetimi', args_hint='<komut>')
