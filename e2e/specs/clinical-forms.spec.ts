import { expect } from '@playwright/test';
import { type Visit } from '@openmrs/esm-framework';
import { test } from '../core';
import { generateRandomPatient, deletePatient, type Patient, startVisit, endVisit } from '../commands';
import { ChartPage, VisitsPage } from '../pages';

let patient: Patient;
let visit: Visit;

const subjectiveFindings = `I've had a headache for the last two days`;
const objectiveFindings = `General appearance is healthy. No signs of distress. Head exam shows no abnormalities, no tenderness on palpation. Neurological exam is normal; cranial nerves intact, normal gait and coordination.`;
const assessment = `Diagnosis: Tension-type headache. Differential Diagnoses: Migraine, sinusitis, refractive error.`;
const plan = `Advise use of over-the-counter ibuprofen as needed for headache pain. Educate about proper posture during reading and screen time; discuss healthy sleep hygiene. Schedule a follow-up appointment in 2 weeks or sooner if the headache becomes more frequent or severe.`;

test.beforeEach(async ({ api }) => {
  patient = await generateRandomPatient(api);
  visit = await startVisit(api, patient.uuid);
});

test('Fill a clinical form', async ({ page }) => {
  const chartPage = new ChartPage(page);
  const visitsPage = new VisitsPage(page);

  await test.step('When I visit the chart summary page', async () => {
    await chartPage.goTo(patient.uuid);
  });

  await test.step('And I click the `Clinical forms` button on the siderail', async () => {
    await page.getByLabel(/clinical forms/i, { exact: true }).click();
  });

  await test.step('Then I should see the clinical forms workspace', async () => {
    const headerRow = chartPage.formsTable().locator('thead > tr');

    await expect(page.getByPlaceholder(/search this list/i)).toBeVisible();
    await expect(headerRow).toContainText(/form name \(a-z\)/i);
    await expect(headerRow).toContainText(/last completed/i);

    await expect(page.getByRole('cell', { name: 'Covid 19', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: /laboratory test results/i, exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: /soap note template/i, exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: /surgical operation/i, exact: true })).toBeVisible();
  });

  await test.step('When I click the `Soap note template` link to launch the form', async () => {
    await page.getByText(/soap note template/i).click();
  });

  await test.step('Then I should see the `Soap note template` form launch in the workspace', async () => {
    await expect(page.getByText(/soap note template/i)).toBeVisible();
  });

  await test.step('When I fill the `Subjective findings` question', async () => {
    await page.getByLabel(/subjective Findings/i).fill(subjectiveFindings);
  });

  await test.step('And I fill the `Objective findings` question', async () => {
    await page.getByLabel(/objective findings/i).fill(objectiveFindings);
  });

  await test.step('And I fill the `Assessment` question', async () => {
    await page.getByLabel(/assessment/i).fill(assessment);
  });

  await test.step('And I fill the `Plan` question', async () => {
    await page.getByLabel(/plan/i).fill(plan);
  });

  await test.step('And I click the `Order basket` button on the siderail', async () => {
    await page.getByRole('button', { name: /order basket/i, exact: true }).click();
  });

  await test.step('And I click the `Add +` button to order drugs', async () => {
    await page.getByRole('button', { name: /add/i }).nth(1).click();
  });

  await test.step('And I click the `Clinical forms` button on the siderail', async () => {
    await page.getByLabel(/clinical forms/i, { exact: true }).click();
  });

  await test.step('Then I should see retained inputs in `Soap note template` form', async () => {
    await expect(page.getByText(subjectiveFindings)).toBeVisible();
    await expect(page.getByText(objectiveFindings)).toBeVisible();
    await expect(page.getByText(assessment)).toBeVisible();
    await expect(page.getByText(plan)).toBeVisible();
  });

  await test.step('And I click on the `Save and close` button', async () => {
    await page.getByRole('button', { name: /save/i }).click();
  });

  await test.step('Then I should see a success notification', async () => {
    await expect(page.getByText(/record created/i, { exact: true })).toBeVisible();
    await expect(page.getByText(/a new encounter was created/i, { exact: true })).toBeVisible();
  });

  await test.step('And if I navigate to the visits dashboard', async () => {
    await visitsPage.goTo(patient.uuid);
  });

  await test.step('Then I should see the newly filled form in the encounters table', async () => {
    await expect(page.getByRole('tab', { name: /visit summaries/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /all encounters/i })).toBeVisible();

    await page.getByRole('tab', { name: /^encounters$/i }).click();

    const headerRow = page.getByRole('table').locator('thead > tr');

    await expect(headerRow).toContainText(/date & time/i);
    await expect(headerRow).toContainText(/encounter type/i);
    await expect(headerRow).toContainText(/provider/i);

    await page.getByRole('table').locator('th#expand').click();

    await expect(page.getByText(subjectiveFindings)).toBeVisible();
    await expect(page.getByText(objectiveFindings)).toBeVisible();
    await expect(page.getByText(assessment)).toBeVisible();
    await expect(page.getByText(plan)).toBeVisible();
  });
});

test('Form state is retained when moving between forms in the workspace', async ({ page }) => {
  const chartPage = new ChartPage(page);
  const visitsPage = new VisitsPage(page);

  await test.step('When I visit the chart summary page', async () => {
    await chartPage.goTo(patient.uuid);
  });

  await test.step('And I click the `Clinical forms` button on the siderail', async () => {
    await page.getByLabel(/clinical forms/i, { exact: true }).click();
  });

  await test.step('Then I should see `Soap note template` listed in the clinical forms workspace', async () => {
    await expect(page.getByRole('cell', { name: /soap note template/i, exact: true })).toBeVisible();
  });

  await test.step('When I click the `Soap note template` link to launch the form', async () => {
    await page.getByText(/soap note template/i).click();
  });

  await test.step('Then I should see the `Soap note template` form launch in the workspace', async () => {
    await expect(page.getByText(/soap note template/i)).toBeVisible();
  });

  await test.step('When I fill the `Subjective findings` and `Objective findings` questions', async () => {
    await page.getByLabel(/subjective Findings/i).fill(subjectiveFindings);
    await page.getByLabel(/objective findings/i).fill(objectiveFindings);
  });

  await test.step('And I click the `Order basket` button on the siderail', async () => {
    await page.getByRole('button', { name: /order basket/i, exact: true }).click();
  });

  await test.step('And I click the `Add +` button to order drugs', async () => {
    await page.getByRole('button', { name: /add/i }).nth(1).click();
  });

  await test.step('And I click the `Clinical forms` button on the siderail', async () => {
    await page.getByLabel(/clinical forms/i, { exact: true }).click();
  });

  await test.step('Then I should see retained inputs in `Soap note template` form', async () => {
    await expect(page.getByText(subjectiveFindings)).toBeVisible();
    await expect(page.getByText(objectiveFindings)).toBeVisible();
  });
});

test.afterEach(async ({ api }) => {
  await endVisit(api, visit.uuid);
  await deletePatient(api, patient.uuid);
});
