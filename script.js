// Quiz State Management
class QuizApp {
    constructor() {
        this.questions = [];
        this.categories = [];
        this.currentCategory = null;
        this.currentQuestionIndex = 0;
        this.currentCategoryQuestionIndex = 0;
        this.answers = {};
        this.categoryScores = {};
        this.totalQuestions = 0;
        
        this.init();
    }
    
    async init() {
        await this.loadQuestions();
        this.bindEvents();
        this.showScreen('welcome-screen');
    }
    
    async loadQuestions() {
        try {
            const response = await fetch('data/questions.json');
            const data = await response.json();
            this.categories = data.categories;
            this.scoringTiers = data.scoringTiers;
            this.recommendations = data.recommendations;
            
            // Flatten all questions and assign global indices
            let globalIndex = 0;
            this.categories.forEach(category => {
                category.questions.forEach(question => {
                    question.globalIndex = globalIndex++;
                    question.categoryId = category.id;
                });
                this.totalQuestions += category.questions.length;
            });
            
            // Initialize category scores
            this.categories.forEach(category => {
                this.categoryScores[category.id] = {
                    correct: 0,
                    total: category.questions.length,
                    completed: 0
                };
            });
        } catch (error) {
            console.error('Error loading questions:', error);
        }
    }
    
    bindEvents() {
        // Welcome screen
        document.getElementById('start-quiz').addEventListener('click', () => {
            this.showScreen('category-screen');
            this.renderCategories();
        });
        
        // Category screen
        document.getElementById('back-to-categories').addEventListener('click', () => {
            this.showScreen('category-screen');
            this.updateOverallProgress();
        });
        
        // Quiz navigation
        document.getElementById('next-question').addEventListener('click', () => {
            this.nextQuestion();
        });
        
        // Results screen
        document.getElementById('retake-quiz').addEventListener('click', () => {
            this.resetQuiz();
        });
        
        document.getElementById('share-results').addEventListener('click', () => {
            this.shareResults();
        });
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }
    
    renderCategories() {
        const container = document.getElementById('category-grid');
        container.innerHTML = '';
        
        this.categories.forEach(category => {
            const card = document.createElement('div');
            card.className = 'category-card';
            
            const completed = this.categoryScores[category.id].completed;
            const total = this.categoryScores[category.id].total;
            
            if (completed === total && completed > 0) {
                card.classList.add('completed');
            }
            
            card.innerHTML = `
                <div class="category-icon">${category.icon}</div>
                <div class="category-name">${category.name}</div>
                <div class="category-description">${category.description}</div>
                <div class="category-progress">
                    <span class="${completed === total && completed > 0 ? 'completed' : ''}">
                        ${completed} / ${total} questions
                    </span>
                </div>
            `;
            
            card.addEventListener('click', () => this.startCategory(category));
            container.appendChild(card);
        });
        
        this.updateOverallProgress();
    }
    
    updateOverallProgress() {
        const completed = Object.values(this.answers).length;
        const percentage = (completed / this.totalQuestions) * 100;
        
        document.getElementById('overall-progress').style.width = `${percentage}%`;
        document.getElementById('progress-text').textContent = 
            `${completed} of ${this.totalQuestions} questions completed`;
    }
    
    startCategory(category) {
        this.currentCategory = category;
        this.currentCategoryQuestionIndex = 0;
        this.showScreen('quiz-screen');
        this.showQuestion();
    }
    
    showQuestion() {
        const question = this.currentCategory.questions[this.currentCategoryQuestionIndex];
        const container = document.getElementById('question-container');
        
        // Update progress
        document.getElementById('current-category').textContent = this.currentCategory.name;
        document.getElementById('question-counter').textContent = 
            `Question ${this.currentCategoryQuestionIndex + 1} of ${this.currentCategory.questions.length}`;
        
        const categoryProgress = ((this.currentCategoryQuestionIndex) / this.currentCategory.questions.length) * 100;
        document.getElementById('category-progress').style.width = `${categoryProgress}%`;
        
        // Clear previous content
        container.innerHTML = '';
        document.getElementById('answer-feedback').classList.add('hidden');
        document.getElementById('next-question').disabled = true;
        
        // Render question based on type
        const questionEl = document.createElement('div');
        questionEl.className = 'question-text';
        questionEl.textContent = question.text;
        container.appendChild(questionEl);
        
        switch (question.type) {
            case 'multiple-choice':
                this.renderMultipleChoice(question, container);
                break;
            case 'true-false':
                this.renderTrueFalse(question, container);
                break;
            case 'matching':
                this.renderMatching(question, container);
                break;
            case 'scenario':
            case 'calculation':
                this.renderMultipleChoice(question, container);
                break;
        }
    }
    
    renderMultipleChoice(question, container) {
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'options-container';
        
        question.options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-button';
            button.innerHTML = `
                <div class="option-indicator"></div>
                <div class="option-text">${option.text}</div>
            `;
            
            button.addEventListener('click', () => {
                if (!button.classList.contains('disabled')) {
                    this.selectOption(question, option, button);
                }
            });
            
            optionsContainer.appendChild(button);
        });
        
        container.appendChild(optionsContainer);
    }
    
    renderTrueFalse(question, container) {
        const tfContainer = document.createElement('div');
        tfContainer.className = 'true-false-container';
        
        ['True', 'False'].forEach(value => {
            const button = document.createElement('button');
            button.className = 'true-false-button';
            button.textContent = value;
            
            button.addEventListener('click', () => {
                if (!button.classList.contains('disabled')) {
                    const isCorrect = (value === 'True') === question.answer;
                    this.selectTrueFalse(question, value === 'True', isCorrect, button);
                }
            });
            
            tfContainer.appendChild(button);
        });
        
        container.appendChild(tfContainer);
    }
    
    renderMatching(question, container) {
        const matchingContainer = document.createElement('div');
        matchingContainer.className = 'matching-container';
        
        const shuffledRights = [...question.pairs].sort(() => Math.random() - 0.5);
        let selectedPairs = {};
        let currentLeft = null;
        
        question.pairs.forEach((pair, index) => {
            const pairContainer = document.createElement('div');
            pairContainer.className = 'matching-pair';
            
            const leftItem = document.createElement('div');
            leftItem.className = 'matching-item left';
            leftItem.textContent = pair.left;
            leftItem.dataset.index = index;
            
            const arrow = document.createElement('div');
            arrow.className = 'matching-arrow';
            arrow.innerHTML = '→';
            
            const rightItem = document.createElement('div');
            rightItem.className = 'matching-item right';
            rightItem.textContent = shuffledRights[index].right;
            rightItem.dataset.rightText = shuffledRights[index].right;
            rightItem.tabIndex = 0;
            
            rightItem.addEventListener('click', () => {
                if (!rightItem.classList.contains('disabled')) {
                    // Toggle selection
                    if (rightItem.classList.contains('selected')) {
                        rightItem.classList.remove('selected');
                        // Remove this pairing
                        Object.keys(selectedPairs).forEach(key => {
                            if (selectedPairs[key] === rightItem.dataset.rightText) {
                                delete selectedPairs[key];
                            }
                        });
                    } else {
                        // Remove previous selection for this right item
                        document.querySelectorAll('.matching-item.right').forEach(item => {
                            if (item.dataset.rightText === rightItem.dataset.rightText) {
                                item.classList.remove('selected');
                            }
                        });
                        
                        rightItem.classList.add('selected');
                        selectedPairs[index] = rightItem.dataset.rightText;
                        
                        // Check if all pairs are selected
                        if (Object.keys(selectedPairs).length === question.pairs.length) {
                            this.checkMatchingAnswer(question, selectedPairs);
                        }
                    }
                }
            });
            
            pairContainer.appendChild(leftItem);
            pairContainer.appendChild(arrow);
            pairContainer.appendChild(rightItem);
            matchingContainer.appendChild(pairContainer);
        });
        
        container.appendChild(matchingContainer);
    }
    
    selectOption(question, selectedOption, buttonEl) {
        // Disable all options
        document.querySelectorAll('.option-button').forEach(btn => {
            btn.classList.add('disabled');
        });
        
        // Mark selected
        buttonEl.classList.add('selected');
        
        // Check answer
        const isCorrect = selectedOption.correct;
        
        setTimeout(() => {
            buttonEl.classList.add(isCorrect ? 'correct' : 'incorrect');
            
            // Show correct answer if wrong
            if (!isCorrect) {
                document.querySelectorAll('.option-button').forEach(btn => {
                    const optionText = btn.querySelector('.option-text').textContent;
                    const correctOption = question.options.find(opt => opt.correct);
                    if (optionText === correctOption.text) {
                        btn.classList.add('correct');
                    }
                });
            }
            
            this.showFeedback(question, isCorrect);
            this.recordAnswer(question, isCorrect);
        }, 300);
    }
    
    selectTrueFalse(question, selected, isCorrect, buttonEl) {
        // Disable all options
        document.querySelectorAll('.true-false-button').forEach(btn => {
            btn.classList.add('disabled');
        });
        
        // Mark selected
        buttonEl.classList.add('selected');
        
        setTimeout(() => {
            buttonEl.classList.add(isCorrect ? 'correct' : 'incorrect');
            
            // Show correct answer if wrong
            if (!isCorrect) {
                document.querySelectorAll('.true-false-button').forEach(btn => {
                    if ((btn.textContent === 'True') === question.answer) {
                        btn.classList.add('correct');
                    }
                });
            }
            
            this.showFeedback(question, isCorrect);
            this.recordAnswer(question, isCorrect);
        }, 300);
    }
    
    checkMatchingAnswer(question, selectedPairs) {
        let allCorrect = true;
        const matchingItems = document.querySelectorAll('.matching-item');
        
        // Disable all items
        matchingItems.forEach(item => item.classList.add('disabled'));
        
        // Check each pair
        question.pairs.forEach((pair, index) => {
            const isCorrect = selectedPairs[index] === pair.right;
            if (!isCorrect) allCorrect = false;
            
            // Mark left items
            matchingItems.forEach(item => {
                if (item.classList.contains('left') && item.dataset.index == index) {
                    item.classList.add(isCorrect ? 'correct' : 'incorrect');
                }
            });
            
            // Mark right items
            matchingItems.forEach(item => {
                if (item.classList.contains('right') && item.dataset.rightText === selectedPairs[index]) {
                    if (item.parentElement.querySelector('.left').dataset.index == index) {
                        item.classList.add(isCorrect ? 'correct' : 'incorrect');
                    }
                }
            });
        });
        
        this.showFeedback(question, allCorrect);
        this.recordAnswer(question, allCorrect);
    }
    
    showFeedback(question, isCorrect) {
        const feedbackEl = document.getElementById('answer-feedback');
        const feedbackContent = feedbackEl.querySelector('.feedback-content');
        
        feedbackEl.classList.remove('hidden', 'error');
        if (!isCorrect) {
            feedbackEl.classList.add('error');
        }
        
        feedbackContent.innerHTML = `
            <div class="feedback-icon">${isCorrect ? '✅' : '❌'}</div>
            <h3 class="feedback-title">${isCorrect ? 'Correct!' : 'Not quite right'}</h3>
            <p class="feedback-explanation">${question.explanation}</p>
            <div class="feedback-impact">${question.impact}</div>
        `;
        
        document.getElementById('next-question').disabled = false;
    }
    
    recordAnswer(question, isCorrect) {
        this.answers[question.globalIndex] = {
            questionId: question.id,
            categoryId: question.categoryId,
            correct: isCorrect
        };
        
        // Update category score
        if (!this.categoryScores[question.categoryId].answeredQuestions) {
            this.categoryScores[question.categoryId].answeredQuestions = new Set();
        }
        
        if (!this.categoryScores[question.categoryId].answeredQuestions.has(question.id)) {
            this.categoryScores[question.categoryId].answeredQuestions.add(question.id);
            this.categoryScores[question.categoryId].completed++;
            if (isCorrect) {
                this.categoryScores[question.categoryId].correct++;
            }
        }
    }
    
    nextQuestion() {
        this.currentCategoryQuestionIndex++;
        
        if (this.currentCategoryQuestionIndex < this.currentCategory.questions.length) {
            this.showQuestion();
        } else {
            // Category completed
            if (Object.keys(this.answers).length === this.totalQuestions) {
                // All questions answered
                this.showResults();
            } else {
                // Return to category selection
                this.showScreen('category-screen');
                this.renderCategories();
            }
        }
    }
    
    showResults() {
        this.showScreen('results-screen');
        
        // Calculate overall score
        const correctAnswers = Object.values(this.answers).filter(a => a.correct).length;
        const percentage = Math.round((correctAnswers / this.totalQuestions) * 100);
        
        // Animate score circle
        const scoreProgress = document.getElementById('score-progress');
        const circumference = 2 * Math.PI * 90;
        const offset = circumference - (percentage / 100) * circumference;
        
        scoreProgress.style.strokeDashoffset = circumference;
        setTimeout(() => {
            scoreProgress.style.strokeDashoffset = offset;
        }, 100);
        
        document.getElementById('score-percentage').textContent = `${percentage}%`;
        
        // Determine tier
        let tier = null;
        for (const [key, value] of Object.entries(this.scoringTiers)) {
            if (percentage >= value.min) {
                tier = value;
            }
        }
        
        document.getElementById('tier-badge').textContent = tier.badge;
        document.getElementById('tier-title').textContent = tier.title;
        document.getElementById('tier-message').textContent = tier.message;
        
        // Show category breakdown
        this.renderCategoryScores();
        
        // Show recommendations
        this.renderRecommendations();
    }
    
    renderCategoryScores() {
        const container = document.getElementById('category-scores');
        container.innerHTML = '';
        
        this.categories.forEach(category => {
            const score = this.categoryScores[category.id];
            const percentage = Math.round((score.correct / score.total) * 100);
            
            const scoreItem = document.createElement('div');
            scoreItem.className = 'category-score-item';
            scoreItem.innerHTML = `
                <div class="category-score-icon">${category.icon}</div>
                <div class="category-score-details">
                    <div class="category-score-name">${category.name}</div>
                    <div class="category-score-bar">
                        <div class="category-score-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
                <div class="category-score-text">${percentage}%</div>
            `;
            
            container.appendChild(scoreItem);
        });
    }
    
    renderRecommendations() {
        // Tools
        const toolsContainer = document.getElementById('tool-recommendations');
        toolsContainer.innerHTML = '';
        
        // Prioritize tools based on weak categories
        const weakCategories = this.categories.filter(cat => {
            const score = this.categoryScores[cat.id];
            return (score.correct / score.total) < 0.7;
        });
        
        // Show first 4 tools, prioritizing those related to weak areas
        this.recommendations.tools.slice(0, 4).forEach(tool => {
            const toolItem = document.createElement('div');
            toolItem.className = 'tool-item';
            toolItem.innerHTML = `
                <a href="${tool.url}" target="_blank" class="tool-name">${tool.name}</a>
                <div class="tool-description">${tool.description}</div>
            `;
            toolsContainer.appendChild(toolItem);
        });
        
        // Resources
        const resourcesContainer = document.getElementById('resource-recommendations');
        resourcesContainer.innerHTML = '';
        
        this.recommendations.resources.forEach(resource => {
            const resourceItem = document.createElement('div');
            resourceItem.className = 'resource-item';
            resourceItem.innerHTML = `
                <span class="resource-title">${resource.title}</span>
                <span class="resource-type">${resource.type}</span>
            `;
            resourcesContainer.appendChild(resourceItem);
        });
    }
    
    shareResults() {
        const correctAnswers = Object.values(this.answers).filter(a => a.correct).length;
        const percentage = Math.round((correctAnswers / this.totalQuestions) * 100);
        
        let tier = null;
        for (const [key, value] of Object.entries(this.scoringTiers)) {
            if (percentage >= value.min) {
                tier = value;
            }
        }
        
        const shareText = `I just scored ${percentage}% on the AI Healthcare Revolution Quiz and earned the title "${tier.title}"! 🎯\n\nTest your knowledge of AI tools transforming healthcare and medical sales:\n`;
        const shareUrl = window.location.href;
        
        const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(shareText)}`;
        
        window.open(linkedInUrl, '_blank', 'width=600,height=600');
    }
    
    resetQuiz() {
        this.answers = {};
        this.currentQuestionIndex = 0;
        this.currentCategoryQuestionIndex = 0;
        
        // Reset category scores
        this.categories.forEach(category => {
            this.categoryScores[category.id] = {
                correct: 0,
                total: category.questions.length,
                completed: 0
            };
        });
        
        this.showScreen('welcome-screen');
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});