import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { restBaseUrl, showSnackbar, useAbortController, useLayoutType } from '@openmrs/esm-framework';
import { Button, ButtonSet, Form, InlineLoading, Stack } from '@carbon/react';
import { type DefaultPatientWorkspaceProps, type Order } from '@openmrs/esm-patient-common-lib';
import { useOrderConceptByUuid, updateOrderResult, useLabEncounter, useObservation } from './lab-results.resource';
import ResultFormField from './result-form-field.component';
import styles from './lab-results-form.scss';
import { mutate } from 'swr';

export interface LabResultsFormProps extends DefaultPatientWorkspaceProps {
  order: Order;
}

const LabResultsForm: React.FC<LabResultsFormProps> = ({
  order,
  closeWorkspace,
  closeWorkspaceWithSavedChanges,
  promptBeforeClosing,
}) => {
  const { t } = useTranslation();
  const abortController = useAbortController();
  const isTablet = useLayoutType() === 'tablet';
  const [obsUuid, setObsUuid] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialValues, setInitialValues] = useState(null);
  const [isLoadingInitialValues, setIsLoadingInitialValues] = useState(false);
  const { concept, isLoading: isLoadingConcepts } = useOrderConceptByUuid(order.concept.uuid);
  const { encounter, isLoading: isLoadingEncounter, mutate: mutateLabOrders } = useLabEncounter(order.encounter.uuid);
  const { data, isLoading: isLoadingObs, error: isErrorObs } = useObservation(obsUuid);

  const {
    control,
    register,
    formState: { errors, isDirty },
    getValues,
    handleSubmit,
  } = useForm<{ testResult: any }>({
    defaultValues: {},
  });

  useEffect(() => {
    if (!isLoadingEncounter && encounter?.obs.length > 0 && !isEditing) {
      const obs = encounter.obs.find((obs) => obs.concept?.uuid === order?.concept.uuid);
      if (obs) {
        setObsUuid(obs.uuid);
        setIsEditing(true);
      }
    }
  }, [isLoadingEncounter, encounter, isEditing, order]);

  useEffect(() => {
    const loadInitialValues = async () => {
      if (isEditing && obsUuid) {
        setIsLoadingInitialValues(true);
        if (data && !isLoadingObs) {
          setInitialValues(data);
        }
        setIsLoadingInitialValues(false);
      }
    };

    loadInitialValues();
  }, [isEditing, obsUuid, data, isLoadingObs]);

  useEffect(() => {
    promptBeforeClosing(() => isDirty);
  }, [isDirty, promptBeforeClosing]);

  if (isLoadingConcepts) {
    return (
      <div className={styles.loaderContainer}>
        <InlineLoading
          className={styles.loader}
          description={t('loadingTestDetails', 'Loading test details') + '...'}
          iconDescription={t('loading', 'Loading')}
          status="active"
        />
      </div>
    );
  }

  const saveLabResults = (data, e) => {
    setIsSubmitting(true);
    e.preventDefault();
    // assign result to test order
    const documentedValues = getValues();
    let obsValue = [];

    if (concept.set && concept.setMembers.length > 0) {
      let groupMembers = [];
      concept.setMembers.forEach((member) => {
        let value;
        if (member.datatype.display === 'Numeric' || member.datatype.display === 'Text') {
          value = getValues()[`${member.uuid}`];
        } else if (member.datatype.display === 'Coded') {
          value = {
            uuid: getValues()[`${member.uuid}`],
          };
        }
        const groupMember = {
          concept: { uuid: member.uuid },
          value: value,
          status: 'FINAL',
          order: { uuid: order.uuid },
        };
        groupMembers.push(groupMember);
      });

      obsValue.push({
        concept: { uuid: order.concept.uuid },
        status: 'FINAL',
        order: { uuid: order.uuid },
        groupMembers: groupMembers,
      });
    } else if (!concept.set && concept.setMembers.length === 0) {
      let value;
      if (concept.datatype.display === 'Numeric' || concept.datatype.display === 'Text') {
        value = getValues()[`${concept.uuid}`];
      } else if (concept.datatype.display === 'Coded') {
        value = {
          uuid: getValues()[`${concept.uuid}`],
        };
      }

      obsValue.push({
        concept: { uuid: order.concept.uuid },
        status: 'FINAL',
        order: { uuid: order.uuid },
        value: value,
      });
    }

    const obsPayload = { obs: obsValue };

    const orderDiscontinuationPayload = {
      previousOrder: order.uuid,
      type: 'testorder',
      action: 'DISCONTINUE',
      careSetting: order.careSetting.uuid,
      encounter: order.encounter.uuid,
      patient: order.patient.uuid,
      concept: order.concept.uuid,
      orderer: order.orderer,
    };

    const resultsStatusPayload = {
      fulfillerStatus: 'COMPLETED',
      fulfillerComment: 'Test Results Entered',
    };

    updateOrderResult(
      order.uuid,
      order.encounter.uuid,
      obsPayload,
      resultsStatusPayload,
      orderDiscontinuationPayload,
      abortController,
    ).then(
      () => {
        setIsSubmitting(false);
        closeWorkspaceWithSavedChanges();
        mutateLabOrders();
        mutate(
          (key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/order?patient=${order.patient.uuid}`),
          undefined,
          { revalidate: true },
        );
        showSnackbar({
          title: t('saveLabResults', 'Save lab results'),
          kind: 'success',
          subtitle: t('successfullySavedLabResults', 'Lab results for {{orderNumber}} have been successfully updated', {
            orderNumber: order?.orderNumber,
          }),
        });
      },
      (err) => {
        setIsSubmitting(false);
        showSnackbar({
          title: t('errorSavingLabResults', 'Error saving lab results'),
          kind: 'error',
          subtitle: err?.message,
        });
      },
    );
  };

  return (
    <Form className={styles.form}>
      <div className={styles.grid}>
        {concept.setMembers.length > 0 && <p className={styles.heading}>{concept.display}</p>}
        {concept && (
          <Stack gap={2}>
            {!isLoadingInitialValues ? (
              <ResultFormField
                defaultValue={initialValues}
                register={register}
                concept={concept}
                control={control}
                errors={errors}
              />
            ) : (
              <InlineLoading description={t('loadingInitialValues', 'Loading initial values') + '...'} />
            )}
          </Stack>
        )}
      </div>

      <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
        <Button className={styles.button} kind="secondary" disabled={isSubmitting} onClick={closeWorkspace}>
          {t('discard', 'Discard')}
        </Button>
        <Button
          className={styles.button}
          kind="primary"
          onClick={handleSubmit(saveLabResults)}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <InlineLoading description={t('saving', 'Saving') + '...'} />
          ) : (
            t('saveAndClose', 'Save and close')
          )}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default LabResultsForm;
