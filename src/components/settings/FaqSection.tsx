import { useState } from "react";
import { useTranslation } from "react-i18next";
import s from "./FaqSection.module.css";

export default function FaqSection() {
    const { t } = useTranslation();
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const FAQ_ITEMS = [
        { category: t("faq.q1.category"), q: t("faq.q1.q"), a: t("faq.q1.a") },
        { category: t("faq.q2.category"), q: t("faq.q2.q"), a: t("faq.q2.a") },
        { category: t("faq.q3.category"), q: t("faq.q3.q"), a: t("faq.q3.a") },
        { category: t("faq.q4.category"), q: t("faq.q4.q"), a: t("faq.q4.a") },
        { category: t("faq.q5.category"), q: t("faq.q5.q"), a: t("faq.q5.a") },
        { category: t("faq.q6.category"), q: t("faq.q6.q"), a: t("faq.q6.a") },
        { category: t("faq.q7.category"), q: t("faq.q7.q"), a: t("faq.q7.a") },
        { category: t("faq.q8.category"), q: t("faq.q8.q"), a: t("faq.q8.a") },
        { category: t("faq.q9.category"), q: t("faq.q9.q"), a: t("faq.q9.a") },
        { category: t("faq.q10.category"), q: t("faq.q10.q"), a: t("faq.q10.a") },
        { category: t("faq.q11.category"), q: t("faq.q11.q"), a: t("faq.q11.a") },
    ];


    // Group FAQ items by Category
    const groupedFAQs = FAQ_ITEMS.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, typeof FAQ_ITEMS>);

    return (
        <div className={s.root}>
            <h2 className={s.title}>{t("faq.title")}</h2>
            <p className={s.desc} style={{ marginBottom: "2em" }}>
                {t("faq.desc")}
            </p>

            {Object.entries(groupedFAQs).map(([category, items]) => (
                <div key={category} className={s.categoryGroup}>
                    <h3 className={s.categoryTitle}>{category}</h3>

                    <div className={s.accordion}>
                        {items.map((item) => {
                            const globalIndex = FAQ_ITEMS.indexOf(item);
                            const isOpen = openIndex === globalIndex;
                            return (
                                <div key={item.q} className={`${s.item} ${isOpen ? s.itemOpen : ""}`}>
                                    <button
                                        className={s.questionBtn}
                                        onClick={() => setOpenIndex(isOpen ? null : globalIndex)}
                                    >
                                        <span className={s.qText}>{item.q}</span>
                                        <span className={s.chevron}>{isOpen ? "−" : "+"}</span>
                                    </button>
                                    {isOpen && (
                                        <div className={s.answer}>
                                            {item.a}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
