alter table public.ai_runtime_settings
  add column if not exists global_system_prompt text not null default 'Türkçe konuşma dilini kullan. Resmî ve robotik cümlelerden kaçın; bağlama göre sıcak, kısa ve doğal cevap ver. Her mesajı soruyla bitirme. Aynı kalıbı tekrar etme.',
  add column if not exists global_knowledge text not null default '';
update public.ai_runtime_settings set deepseek_model='deepseek-v4-flash' where deepseek_model='deepseek-chat';
update public.ai_runtime_settings set openrouter_model='deepseek/deepseek-v4-flash' where openrouter_model='openai/gpt-5.6-luna';
update public.ai_runtime_settings set default_provider='openrouter', fallback_order=array['deepseek','gemini','openai'] where default_provider='openai';
