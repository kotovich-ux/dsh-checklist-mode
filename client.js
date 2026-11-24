// Клиентская половина dsh-checklist-mode.
//
// Задача: в меню «Команды» строка /checklist должна выглядеть как штатные
// команды — иконка, название на языке интерфейса DSH и (рядом) английское имя.
//
// В DSH 2026-11 иконка и локализованное название есть только у встроенных
// команд: клиент держит их в таблице HOST_FACES
// (@deepseek-ai/dsh-client-ui-commands/src/client/presentation.ts), а дескриптор
// хостовой команды несёт лишь name/description/input.hint. Публичный API
// ctx.commandUi умеет только полностью клиентские команды (contribution; имя не
// должно совпадать с хостовой) и decorations (поведение, без иконки).
//
// Поэтому здесь мы оборачиваем CommandUiRuntime.candidates — единственное место,
// где собираются строки меню, — и дорисовываем свою строку. Подмена мягкая: если
// в новой версии DSH метода не станет, иконка и название просто не появятся,
// сама команда продолжит работать.
window.__ModuleLoader__.load({
	id: "dsh-checklist-mode",
	factory: (require) => {
		var module = { exports: {} }
		var exports = module.exports

		const React = require("react")
		const h = React.createElement

		// «Лист с двумя строками»: у первой чекбокс с галочкой, у второй — пустой.
		// Штриховая монохромная графика в духе штатных иконок меню; размер и цвет
		// приходят от MenuView (<item.icon size={14} />) и currentColor.
		function ChecklistIcon(props) {
			const size = (props && props.size) || 16
			const line = {
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.15,
				strokeLinecap: "round",
				strokeLinejoin: "round",
			}
			return h(
				"svg",
				{
					xmlns: "http://www.w3.org/2000/svg",
					width: size,
					height: size,
					viewBox: "0 0 16 16",
					className: props && props.className,
					"aria-hidden": "true",
					focusable: "false",
				},
				h("rect", { ...line, x: 2.4, y: 1.7, width: 11.2, height: 12.6, rx: 1.8 }),
				// первая строка: чекбокс с галочкой + «нечитаемая» линия текста
				h("rect", { ...line, x: 4.2, y: 4.1, width: 2.5, height: 2.5, rx: 0.6 }),
				h("path", { ...line, d: "M4.75 5.35l0.75 0.75 1.35-1.55" }),
				h("line", { ...line, x1: 7.9, y1: 5.35, x2: 11.9, y2: 5.35 }),
				// вторая строка: пустой чекбокс + такая же линия
				h("rect", { ...line, x: 4.2, y: 8.5, width: 2.5, height: 2.5, rx: 0.6 }),
				h("line", { ...line, x1: 7.9, y1: 9.75, x2: 11.9, y2: 9.75 }),
			)
		}

		const COMMAND = "checklist"
		const MARK = "__dshChecklistFace"
		const NS = "checklist"

		// Название и описание берём из словаря DSH по активному языку интерфейса
		// (ctx.locale), а не из navigator.language: язык в DSH переключается в
		// настройках и не обязан совпадать с языком системы. Русский/английский —
		// то, что реально используется; zh — базовый локаль для остальных языков,
		// которые падают на en.
		const DICTIONARY = {
			en: {
				label: "Checklist",
				description: "Strict mode: a numbered plan, one step at a time",
			},
			ru: {
				label: "Чеклист",
				description: "Строгий режим: план по пунктам, без переделок, вопросы при выборе",
			},
			zh: {
				label: "清单模式",
				description: "严格模式：编号计划，逐项执行",
			},
		}

		/** Добавить нашей строке иконку и локализованное название; чужие строки не трогаем. */
		function faceRows(rows, t) {
			if (!Array.isArray(rows)) return rows
			let changed = false
			const next = rows.map((row) => {
				if (!row || row.name !== COMMAND || row.icon !== undefined) return row
				changed = true
				return {
					...row,
					label: t("label"),
					description: t("description"),
					icon: ChecklistIcon,
				}
			})
			return changed ? next : rows
		}

		exports.inject = ["commandUi", "locale"]

		exports.apply = (ctx) => {
			const ui = ctx.commandUi
			const proto = ui === undefined || ui === null ? undefined : Object.getPrototypeOf(ui)
			const original = proto && proto.candidates
			if (typeof original !== "function") {
				console.warn(
					"[dsh-checklist] меню команд: CommandUiRuntime.candidates не найден — иконка и название не применены",
				)
				return
			}
			ctx.effect(
				() => ctx.locale.register(NS, DICTIONARY),
				"dsh-checklist: dictionaries",
			)
			// bind возвращает стабильную функцию, читающую активный язык в момент
			// вызова, поэтому смена языка в настройках DSH применяется к следующему
			// открытию меню без перезагрузки страницы.
			const t = ctx.locale.bind(NS)
			if (original[MARK] === true) return
			const wrapped = async function candidatesWithChecklistFace(...args) {
				return faceRows(await original.apply(this, args), t)
			}
			wrapped[MARK] = true
			proto.candidates = wrapped
			ctx.effect(
				() => () => {
					if (proto.candidates === wrapped) proto.candidates = original
				},
				"dsh-checklist: command face",
			)
		}

		return module.exports
	},
})
