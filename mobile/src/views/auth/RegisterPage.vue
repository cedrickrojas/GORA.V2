<template>
  <AuthShell title="Create Account" subtitle="Join GORA to find games near you." title-id="register-title">
    <form class="auth-form" novalidate @submit.prevent="submit">
      <p v-if="formError" class="auth-alert" role="alert">{{ formError }}</p>

      <AuthField
        id="register-username"
        v-model="form.username"
        label="Username"
        autocomplete="username"
        :maxlength="30"
        :error="visibleErrors.username"
        :disabled="isSubmitting"
      />
      <div class="register-names">
        <AuthField
          id="register-first-name"
          v-model="form.firstName"
          label="First Name"
          autocomplete="given-name"
          :maxlength="NAME_MAX_LENGTH"
          :error="visibleErrors.firstName"
          :disabled="isSubmitting"
        />
        <AuthField
          id="register-last-name"
          v-model="form.lastName"
          label="Last Name"
          autocomplete="family-name"
          :maxlength="NAME_MAX_LENGTH"
          :error="visibleErrors.lastName"
          :disabled="isSubmitting"
        />
      </div>
      <AuthField
        id="register-email"
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
        id="register-password"
        v-model="form.password"
        label="Password"
        type="password"
        autocomplete="new-password"
        :maxlength="PASSWORD_MAX_LENGTH"
        :error="visibleErrors.password"
        :disabled="isSubmitting"
      />
      <AuthField
        id="register-confirm-password"
        v-model="form.confirmPassword"
        label="Confirm Password"
        type="password"
        autocomplete="new-password"
        :maxlength="PASSWORD_MAX_LENGTH"
        :error="visibleErrors.confirmPassword"
        :disabled="isSubmitting"
      />

      <button type="submit" class="auth-submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Creating account...' : 'Create Account' }}
      </button>
    </form>

    <template #footer>
      Already have an account? <router-link to="/login">Login</router-link>
    </template>
  </AuthShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { onIonViewWillEnter } from '@ionic/vue';
import AuthField from '@/components/auth/AuthField.vue';
import AuthShell from '@/components/auth/AuthShell.vue';
import { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/stores/auth';
import type { RegisterField, RegisterInput } from '@/types/auth';
import {
  DEFAULT_AUTHENTICATED_PATH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  hasErrors,
  validateRegisterInput,
  type FieldErrors,
} from '@/utils/auth';

const auth = useAuthStore();
const router = useRouter();

const emptyForm = (): RegisterInput => ({
  username: '',
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
});

const form = reactive<RegisterInput>(emptyForm());
const attempted = ref(false);
const isSubmitting = ref(false);
const formError = ref<string | null>(null);
const serverErrors = ref<FieldErrors<RegisterField>>({});

const errors = computed(() => validateRegisterInput(form));
const visibleErrors = computed<FieldErrors<RegisterField>>(() => ({
  ...serverErrors.value,
  ...(attempted.value ? errors.value : {}),
}));

function clearPasswords(): void {
  form.password = '';
  form.confirmPassword = '';
}

function resetFeedback(): void {
  attempted.value = false;
  formError.value = null;
  serverErrors.value = {};
}

/** Duplicate username/email (409) belongs next to the field it is about. */
function showServerError(error: unknown): void {
  const message = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

  if (error instanceof ApiError && error.status === 409) {
    const field: RegisterField | null = /username/i.test(message) ? 'username' : /email/i.test(message) ? 'email' : null;

    if (field) {
      serverErrors.value = { [field]: message };
      return;
    }
  }

  formError.value = message;
}

async function submit(): Promise<void> {
  attempted.value = true;
  formError.value = null;
  serverErrors.value = {};

  if (isSubmitting.value || hasErrors(errors.value)) {
    return;
  }

  isSubmitting.value = true;

  try {
    await auth.register({ ...form });
    Object.assign(form, emptyForm());
    resetFeedback();
    await router.replace(DEFAULT_AUTHENTICATED_PATH);
  } catch (error) {
    clearPasswords();
    attempted.value = false;
    showServerError(error);
  } finally {
    isSubmitting.value = false;
  }
}

onIonViewWillEnter(() => {
  clearPasswords();
  resetFeedback();
});
</script>

<style scoped>
.register-names {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 340px) {
  .register-names {
    grid-template-columns: 1fr;
  }
}
</style>
