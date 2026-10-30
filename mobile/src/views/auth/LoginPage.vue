<template>
  <AuthShell title="Log in" subtitle="Welcome back. Your games are waiting." title-id="login-title">
    <form class="auth-form" novalidate @submit.prevent="submit">
      <p v-if="formError" class="auth-alert" role="alert">{{ formError }}</p>

      <AuthField
        id="login-email"
        v-model="form.email"
        label="Email"
        type="email"
        inputmode="email"
        autocomplete="email"
        :maxlength="254"
        :error="visibleErrors.email"
        :disabled="isSubmitting"
      />
      <AuthField
        id="login-password"
        v-model="form.password"
        label="Password"
        type="password"
        autocomplete="current-password"
        :maxlength="PASSWORD_MAX_LENGTH"
        :error="visibleErrors.password"
        :disabled="isSubmitting"
      />

      <button type="submit" class="auth-submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Logging in...' : 'Login' }}
      </button>
    </form>

    <template #footer>
      Don't have an account? <router-link to="/register">Create Account</router-link>
    </template>
  </AuthShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { onIonViewWillEnter } from '@ionic/vue';
import AuthField from '@/components/auth/AuthField.vue';
import AuthShell from '@/components/auth/AuthShell.vue';
import { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/stores/auth';
import { PASSWORD_MAX_LENGTH, hasErrors, postLoginPath, validateLoginInput } from '@/utils/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const form = reactive({ email: '', password: '' });
const attempted = ref(false);
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

const errors = computed(() => validateLoginInput(form));
const visibleErrors = computed(() => (attempted.value ? errors.value : {}));

function resetForm(): void {
  form.password = '';
  attempted.value = false;
  formError.value = null;
}

async function submit(): Promise<void> {
  attempted.value = true;
  formError.value = null;

  if (isSubmitting.value || hasErrors(errors.value)) {
    return;
  }

  isSubmitting.value = true;

  try {
    await auth.login({ ...form });
    const destination = postLoginPath(route.query.redirect, auth.currentUser?.role);
    form.email = '';
    resetForm();
    await router.replace(destination);
  } catch (error) {
    form.password = '';
    attempted.value = false;
    formError.value = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
}

onIonViewWillEnter(resetForm);
</script>
