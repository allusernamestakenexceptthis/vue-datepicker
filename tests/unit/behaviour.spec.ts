import { describe, expect, it } from 'vitest';
import { add, addHours, addMinutes, addMonths, getHours, getMinutes, getMonth, getYear, set } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz/esm';

import { resetDateTime } from '@/utils/date-utils';

import { openMenu } from '../utils';

describe('It should validate various picker scenarios', () => {
    it('Should dynamically disable times', async () => {
        const modelValue = set(new Date(), { hours: 12, minutes: 0, seconds: 0, milliseconds: 0 });
        const disabledTimes = [
            { hours: 14, minutes: 15 },
            { hours: 14, minutes: 20 },
            { hours: 15, minutes: '*' },
        ];
        const dp = await openMenu({ modelValue, disabledTimes });

        const setHours = async (val: number) => {
            await dp.find(`[data-test="open-time-picker-btn"]`).trigger('click');

            await dp.find(`[data-test="hours-toggle-overlay-btn"]`).trigger('click');
            await dp.find(`[data-test="${val}"]`).trigger('click');
        };

        await setHours(14);

        await dp.find(`[data-test="minutes-toggle-overlay-btn"]`).trigger('click');

        await dp.vm.$nextTick();
        const el = dp.find(`[data-test="15"]`);

        expect(el.attributes()['aria-disabled']).toEqual('true');

        for (let i = 0; i < 20; i++) {
            await dp.find(`[data-test="minutes-time-inc-btn"]`).trigger('click');
        }

        const minutesOverlayBtn = dp.find(`[data-test="minutes-toggle-overlay-btn"]`);
        expect(minutesOverlayBtn.classes()).toContain('dp--time-invalid');

        await setHours(15);
        const hoursOverlayBtn = dp.find(`[data-test="hours-toggle-overlay-btn"]`);
        expect(hoursOverlayBtn.classes()).toContain('dp--time-invalid');
        dp.unmount();
    });

    it('Should auto apply date in the flow mode (#465)', async () => {
        const dp = await openMenu({ flow: ['month', 'year', 'calendar'], autoApply: true });
        const date = add(new Date(), { months: 1, years: 1 });

        const year = getYear(date);

        const month = new Intl.DateTimeFormat('en-Us', { month: 'short', timeZone: 'UTC' }).format(date);
        const monthName = month.charAt(0).toUpperCase() + month.substring(1);

        await dp.find(`[data-test="${monthName}"]`).trigger('click');
        await dp.find(`[data-test="${year}"]`).trigger('click');
        const dateVal = resetDateTime(date);
        await dp.find(`[data-test="${dateVal}"]`).trigger('click');
        const emitted = dp.emitted();
        expect(emitted).toHaveProperty('update:model-value', [[set(date, { seconds: 0, milliseconds: 0 })]]);
    });

    it('Should not switch calendars in 1 month range with multi-calendars enabled (#472)', async () => {
        const dp = await openMenu({ multiCalendars: true, range: true });
        const firstDate = resetDateTime(new Date());
        const secondDate = resetDateTime(set(firstDate, { month: getMonth(addMonths(firstDate, 1)), date: 15 }));

        const firstDateEl = dp.find(`[data-test="${firstDate}"]`);
        const secondDateEl = dp.find(`[data-test="${secondDate}"]`);

        await firstDateEl.trigger('click');
        await secondDateEl.trigger('click');

        const innerStartCell = firstDateEl.find('.dp__cell_inner');

        const innerEndCell = secondDateEl.find('.dp__cell_inner');

        expect(innerStartCell.classes()).toContain('dp__range_start');
        expect(innerEndCell.classes()).toContain('dp__range_end');
    });

    it('Should not enable partial range with text-input on time-picker (#505)', async () => {
        const dp = await openMenu({ textInput: true, timePicker: true, range: true });
        const today = new Date();
        const hours = getHours(today);
        const minutes = getMinutes(today);

        const singleTime = `${hours}:${minutes}`;

        const input = dp.find('input');
        await input.setValue(singleTime);

        expect(input.element.value).toBe(singleTime);

        await input.trigger('keydown.enter');

        expect(dp.emitted()).toHaveProperty('invalid-select', [
            [[set(new Date(), { hours, minutes, seconds: 0, milliseconds: 0 })]],
        ]);
    });

    it('Should emit regular and zoned date value', async () => {
        const timezone = 'UTC';
        const dp = await openMenu({ emitTimezone: timezone });
        const today = new Date();
        const value = set(today, { seconds: 0, milliseconds: 0 });

        await dp.find(`[data-test="${resetDateTime(today)}"]`).trigger('click');
        await dp.find(`[data-test="select-button"]`).trigger('click');

        const emitted = dp.emitted();

        expect(emitted).toHaveProperty('update:model-value', [[value]]);
        expect(emitted).toHaveProperty('update:model-timezone-value', [[utcToZonedTime(value, timezone)]]);
    });

    it('Should set predefined value in the time-picker and emit updated value', async () => {
        const today = new Date();
        const modelValue = { hours: getHours(today), minutes: getMinutes(today), seconds: 0 };
        const dp = await openMenu({ timePicker: true, modelValue });

        const hours = dp.find(`[data-test="hours-toggle-overlay-btn"]`);
        const minutes = dp.find(`[data-test="minutes-toggle-overlay-btn"]`);

        expect(hours.text()).toEqual(`${modelValue.hours}`);
        expect(minutes.text()).toEqual(`${modelValue.minutes}`);

        await dp.find(`[data-test="hours-time-inc-btn"]`).trigger('click');
        await dp.find(`[data-test="minutes-time-inc-btn"]`).trigger('click');
        await dp.find(`[data-test="select-button"]`).trigger('click');

        const emitted = dp.emitted();
        expect(emitted).toHaveProperty('update:model-value', [
            [{ hours: getHours(addHours(today, 1)), minutes: getMinutes(addMinutes(today, 1)), seconds: 0 }],
        ]);
    });
});