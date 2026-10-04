import asyncio
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('lovask_admin', Path(__file__).with_name('__init__.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

async def fake_post(payload):
    return {'tickets': []} if payload['action'] == 'support_list' else {'error': 'blocked'}

module.asyncio.to_thread = lambda fn, *args: fake_post(*args)
assert asyncio.run(module._handle('destek')) == 'Açık destek talebi yok.'
assert 'Komut anlaşılmadı' in asyncio.run(module._handle('yanlis'))
assert 'Tutar sayı olmalı' in asyncio.run(module._handle('onay id ref NaN-degil'))
