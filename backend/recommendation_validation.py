"""Validate publishable advice against actual survey question definitions."""
def rule_error(row, questions):
    if not all(isinstance(row.get(k),str) and row[k].strip() for k in ('recommendation','reason')):
        return 'Для публикации правила заполните рекомендацию и понятное объяснение.'
    if not isinstance(row.get('source_url'),str) or not row['source_url'].startswith('https://'):
        return 'Перед публикацией правила добавьте источник с адресом https://.'
    condition=row.get('condition')
    if not isinstance(condition,dict):return 'Проверьте условие правила.'
    question=next((q for q in questions if q['key']==condition.get('key')),None)
    if not question:return 'Неизвестный ключ ответа в правиле.'
    operator='contains' if question['type']=='multi' else 'equals'
    if set(condition)!={'key',operator}:return 'Условие должно проверять один ответ выбранного вопроса.'
    value=condition[operator]
    if value is None or value=='':return 'Выберите значение ответа в правиле.'
    options=question.get('options') or []
    if options and value not in [o['value'] for o in options]:return 'Значение ответа отсутствует в выбранном вопросе.'
    if question['type']=='number' and (isinstance(value,bool) or not isinstance(value,(int,float))):return 'Для числового вопроса укажите число.'
    return None
