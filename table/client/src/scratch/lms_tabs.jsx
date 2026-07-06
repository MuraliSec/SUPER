                        {subTab === 'submissions' && (
                            <div>
                                <h4 style={{ marginBottom: '20px' }}>Student Submissions</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {submissions.map(sub => (
                                        <div key={sub._id} style={{ padding: '15px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>{sub.studentId?.name}</div>
                                                <div style={{ fontSize: '12px', color: '#718096' }}>Submitted: {new Date(sub.submittedAt).toLocaleString()}</div>
                                                {sub.grade && <div style={{ fontSize: '12px', color: '#48bb78', fontWeight: 'bold' }}>Grade: {sub.grade}</div>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                {sub.fileUrl && <a href={sub.fileUrl} target="_blank" rel="noreferrer" style={{ background: '#edf2f7', color: '#4c51bf', padding: '5px 10px', borderRadius: '5px', textDecoration: 'none', fontSize: '12px' }}>View File</a>}
                                                <button 
                                                    onClick={() => { setGradingSubmission(sub); setShowAddModal('grade'); setModalData({ grade: sub.grade, feedback: sub.feedback }); }}
                                                    style={{ background: '#4c51bf', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }}
                                                >
                                                    {sub.grade ? 'Edit Grade' : 'Grade'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {submissions.length === 0 && <p style={{ textAlign: 'center', color: '#a0aec0' }}>No submissions yet.</p>}
                                </div>
                            </div>
                        )}

                        {subTab === 'quizzes' && (
                            <div>
                                {quizPlay ? (
                                    <div style={{ background: '#f8fafc', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                                            <h3 style={{ margin: 0 }}>Quiz: {quizPlay.title}</h3>
                                            <button 
                                                onClick={() => setQuizPlay(null)}
                                                style={{ background: '#718096', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer' }}
                                            >
                                                Exit Quiz
                                            </button>
                                        </div>
                                        
                                        {quizPlay.questions?.length > 0 ? (
                                            <div>
                                                {/* Question UI would go here */}
                                                <p>Question {quizPlay.currentQuestion + 1} of {quizPlay.questions.length}</p>
                                                <button 
                                                    onClick={submitQuiz}
                                                    style={{ background: '#4c51bf', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', marginTop: '20px' }}
                                                >
                                                    Submit Quiz
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '50px' }}>
                                                <p style={{ color: '#718096' }}>This quiz has no questions yet.</p>
                                                <button 
                                                    onClick={() => setQuizPlay(null)}
                                                    style={{ background: '#4c51bf', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
                                                >
                                                    Go Back
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <h4 style={{ marginBottom: '20px' }}>Course Quizzes</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            {activeCourse.modules.flatMap(m => m.quizzes).map((quiz, idx) => (
                                                <div key={idx} style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fffaf0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <h5 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{quiz.title}</h5>
                                                            <p style={{ margin: 0, fontSize: '13px', color: '#718096' }}>{quiz.questions?.length || 0} Questions</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => startQuiz(quiz)}
                                                            style={{ background: '#f6ad55', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                                                        >
                                                            {viewingAs === 'student' ? 'Start Quiz' : 'Conduct / Demo'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {activeCourse.modules.flatMap(m => m.quizzes).length === 0 && (
                                                <div style={{ textAlign: 'center', color: '#a0aec0', padding: '40px' }}>
                                                    <p>No quizzes yet.</p>
                                                    {(viewingAs === 'hod' || viewingAs === 'faculty') && activeCourse.modules.length > 0 && (
                                                        <button 
                                                            onClick={() => openModal('quiz', activeCourse.modules[0]._id)}
                                                            style={{ background: '#edf2f7', color: '#f6ad55', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                                                        >
                                                            + Add First Quiz
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
