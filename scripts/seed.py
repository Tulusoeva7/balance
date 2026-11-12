"""Print seed SQL for a new installation after applying the application schema."""
import json
from pathlib import Path
content=json.loads((Path(__file__).resolve().parent.parent/'database/content.json').read_text())
def literal(value):return "'"+json.dumps(value,ensure_ascii=False).replace("'","''")+"'::jsonb"
print('begin;')
for i,q in enumerate(content['questions']):
 kind={'single':'single_choice','multi':'multi_choice','number':'scale','time':'text','text':'text'}[q['type']]
 print(f"insert into public.survey_questions(question_text,question_type,question_key,definition,order_index) select {literal(q)}->>'label','{kind}',{literal(q)}->>'key',{literal(q)},{i} where not exists(select 1 from public.survey_questions where question_key={literal(q)}->>'key');")
for table,items,fields in [('exercises',content['exercises'],'title,body_zone,difficulty,duration_seconds,description,instructions,target_zones,repetitions,limitations,applicability,source_url'),('articles',content['articles'],'title,category,content,target_zones,source_url')]:
 for item in items:print(f"insert into public.{table}({fields}) select {fields} from jsonb_populate_record(null::public.{table},{literal(item)}) where not exists(select 1 from public.{table} where title={literal(item)}->>'title');")
rules=json.loads((Path(__file__).resolve().parent.parent/'database/recommendation_rules.json').read_text())
for rule in rules:
 fields=','.join(rule)
 print(f"insert into public.recommendation_rules({fields}) select {fields} from jsonb_populate_record(null::public.recommendation_rules,{literal(rule)}) on conflict(id) do nothing;")
print('commit;')
