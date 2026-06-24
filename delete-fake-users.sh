```
DELETE FROM public.results  WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'seed-%@seed.daily-district.test');
DELETE FROM public.profiles WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'seed-%@seed.daily-district.test');
DELETE FROM auth.users      WHERE email LIKE 'seed-%@seed.daily-district.test';
```