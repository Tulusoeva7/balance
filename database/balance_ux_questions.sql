-- Balance UX: clearer physical-screen wording and adaptive follow-up.
update public.survey_questions
set question_text='Сколько физических экранов вы обычно используете во время работы?',
    definition=jsonb_set(jsonb_set(definition,'{label}','"Сколько физических экранов вы обычно используете во время работы?"'::jsonb),'{hint}','"Например, экран ноутбука и внешний монитор считаются двумя экранами. Вкладки браузера не считаются."'::jsonb)
where question_key='screens';

update public.survey_questions
set definition=jsonb_set(definition,'{when}','{"key":"screens","not_equals":"1"}'::jsonb)
where question_key='external_screen';
